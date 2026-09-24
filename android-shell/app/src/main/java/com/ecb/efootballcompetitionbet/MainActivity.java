package com.ecb.efootballcompetitionbet;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.graphics.drawable.GradientDrawable;
import android.widget.ImageView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebViewClientCompat;

import java.io.InputStream;


public class MainActivity extends Activity {
    private static final String APP_URL =
        "https://lslonlinebetting.lovable.app/";
    private static final String APP_HOST = "lslonlinebetting.lovable.app";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2001;
    private static final String NOTIFICATION_CHANNEL_ID = "ecb_updates";

    private SwipeRefreshLayout swipeRefresh;
    private WebView webView;

    private final Handler updateHandler = new Handler(Looper.getMainLooper());
    private final Runnable updatePoll = new Runnable() {
        @Override public void run() {
            UpdateChecker.check(MainActivity.this);
            updateHandler.postDelayed(this, 3000L);
        }
    };

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xFF080808);
        getWindow().setNavigationBarColor(0xFF080808);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF080808);

        swipeRefresh = new SwipeRefreshLayout(this);
        swipeRefresh.setColorSchemeColors(0xFFFFC400);
        swipeRefresh.setEnabled(true);
        ViewCompat.setOnApplyWindowInsetsListener(swipeRefresh, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(0, bars.top, 0, bars.bottom);
            return insets;
        });

        webView = new WebView(this);
        webView.addJavascriptInterface(new NativeNotificationBridge(this), "ECBAndroid");

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // The standalone APK uses the same fixed 1280px desktop canvas as the site.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
        settings.setTextZoom(100);
        webView.setInitialScale(55);

        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        settings.setUserAgentString(
            settings.getUserAgentString() + " ECBAndroidApp/" + BuildConfig.VERSION_NAME
        );

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return interceptLocalRequest(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return interceptLocalRequest(Uri.parse(url));
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && url.matches("(?i).*\\\\.apk(?:[?#].*)?$")) {
                    UpdateChecker.downloadAndInstallFromUrl(MainActivity.this, url);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                view.setInitialScale(55);
                injectAndroidAppState(view);
            }
        });

        webView.setDownloadListener(
            (url, userAgent, contentDisposition, mimeType, contentLength) ->
                UpdateChecker.downloadAndInstallFromUrl(MainActivity.this, url)
        );

        swipeRefresh.setOnChildScrollUpCallback(
            (parent, child) -> webView != null && webView.canScrollVertically(-1)
        );
        swipeRefresh.addView(
            webView,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        );
        swipeRefresh.setOnRefreshListener(() -> webView.reload());
        root.addView(
            swipeRefresh,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        );

        ImageView homeLogo = new ImageView(this);
        homeLogo.setImageResource(R.drawable.site_logo);
        homeLogo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        homeLogo.setContentDescription("Go to E-Football home");
        homeLogo.setClickable(true);
        homeLogo.setFocusable(true);
        homeLogo.setOnClickListener(v -> webView.loadUrl(APP_URL));

        int density = (int) getResources().getDisplayMetrics().density;
        int logoSize = 56 * density;
        GradientDrawable logoCircle = new GradientDrawable();
        logoCircle.setShape(GradientDrawable.OVAL);
        logoCircle.setColor(0xEE080808);
        logoCircle.setStroke(2 * density, 0xFFFFC400);
        homeLogo.setBackground(logoCircle);
        homeLogo.setPadding(5 * density, 5 * density, 5 * density, 5 * density);
        homeLogo.setClipToOutline(true);

        FrameLayout.LayoutParams logoParams = new FrameLayout.LayoutParams(
            logoSize, logoSize, Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM
        );
        logoParams.bottomMargin = 16 * density;
        root.addView(homeLogo, logoParams);

        setContentView(root);
        webView.loadUrl(APP_URL);

        createNotificationChannel();
        requestNotificationPermissionIfNeeded();
        UpdateChecker.check(this);
        root.postDelayed(() -> UpdateChecker.check(this), 5000L);
        updateHandler.postDelayed(updatePoll, 3000L);
    }

    private WebResourceResponse interceptLocalRequest(Uri uri) {
        if (uri == null || !APP_HOST.equalsIgnoreCase(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || "/".equals(path) || path.isEmpty() || !path.substring(path.lastIndexOf('/') + 1).contains(".")) {
            return serveBundledFile("_shell.html", "text/html", "UTF-8");
        }
        if (path.startsWith("/assets/")) {
            return serveBundledFile(path.substring(1), guessMime(path), guessEncoding(path));
        }
        // Public bundled assets (favicon, manifest, etc.).
        WebResourceResponse asset = serveBundledFile(path.substring(1), guessMime(path), guessEncoding(path));
        return asset;
    }

    private String guessMime(String path) {
        String ext = MimeTypeMap.getFileExtensionFromUrl(path);
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime != null ? mime : "application/octet-stream";
    }

    private String guessEncoding(String path) {
        String mime = guessMime(path);
        return mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "UTF-8" : null;
    }

    private WebResourceResponse serveBundledFile(String filename, String mime, String encoding) {
        try {
            InputStream input = getAssets().open(filename);
            return new WebResourceResponse(mime, encoding, input);
        } catch (Exception ignored) {
            return null;
        }
    }

    private void injectAndroidAppState(WebView view) {
        String version = BuildConfig.VERSION_NAME.replace("\\", "\\\\").replace("'", "\\'");
        String script =
            "(function(){"
            + "var version='" + version + "';"
            + "window.ECB_ANDROID_APP_VERSION=version;"
            + "function sync(){"
            + "document.querySelectorAll('[data-app-version]').forEach(function(el){"
            + "el.setAttribute('data-app-version',version);"
            + "var s=el.querySelector('span');"
            + "if(s)s.textContent='App version '+version;"
            + "});"
            + "}"
            + "sync();"
            + "if(document.body&&!window.__ecbVersionObserver){"
            + "window.__ecbVersionObserver=new MutationObserver(sync);"
            + "window.__ecbVersionObserver.observe(document.body,{childList:true,subtree:true});"
            + "}"
            + "if(!window.__ecbApkOpenPatched){"
            + "var original=window.open;"
            + "window.open=function(url){"
            + "if(typeof url==='string'&&/\\\\.apk(?:[?#]|$)/i.test(url)){window.location.href=url;return null;}"
            + "return original.apply(window,arguments);"
            + "};"
            + "window.__ecbApkOpenPatched=true;"
            + "}"
            + "})();";
        view.evaluateJavascript(script, null);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel channel = new NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "E-Football Competition Bet notifications",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Important E-Football Competition Bet updates.");
        manager.createNotificationChannel(channel);

        NotificationChannel realtime = new NotificationChannel(
            "ecb_realtime",
            "Realtime notifications",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        realtime.setDescription("Realtime E-Football Competition Bet notifications.");
        manager.createNotificationChannel(realtime);
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED) return;
        requestPermissions(
            new String[]{Manifest.permission.POST_NOTIFICATIONS},
            NOTIFICATION_PERMISSION_REQUEST
        );
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        UpdateChecker.check(this);
        updateHandler.removeCallbacks(updatePoll);
        updateHandler.post(updatePoll);
    }

    @Override
    protected void onPause() {
        updateHandler.removeCallbacks(updatePoll);
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        updateHandler.removeCallbacks(updatePoll);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
