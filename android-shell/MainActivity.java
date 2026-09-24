package com.ecb.efootballcompetitionbet;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.MimeTypeMap;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.annotation.RequiresApi;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import java.io.InputStream;

public class MainActivity extends Activity {
    private static final String LOCAL_APP_URL = "https://appassets.androidplatform.net/assets/index.html";
    private WebView webView;
    private final Handler updateHandler = new Handler(Looper.getMainLooper());
    private final Runnable updatePoll = new Runnable() {
        @Override public void run() {
            if (!isFinishing()) UpdateChecker.check(MainActivity.this, true);
            updateHandler.postDelayed(this, 3000);
        }
    };

    private WebResourceResponse serveLocalAsset(String path) {
        String relative = path.startsWith("/") ? path.substring(1) : path;
        if (relative.isEmpty()) relative = "index.html";
        try {
            InputStream input = getAssets().open(relative);
            String extension = MimeTypeMap.getFileExtensionFromUrl(relative);
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            if (mime == null) mime = "application/octet-stream";
            String encoding = (mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json"))
                ? "UTF-8" : null;
            return new WebResourceResponse(mime, encoding, input);
        } catch (Exception ignored) {
            try {
                InputStream input = getAssets().open("index.html");
                return new WebResourceResponse("text/html", "UTF-8", input);
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // The APK contains the complete web client. The website's shared 1280px
        // desktop canvas is therefore rendered from the exact source shipped
        // inside this APK rather than loading a changing remote website.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        webView.setInitialScale(55);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);

        String desktopUa = settings.getUserAgentString()
            .replace(" Mobile", "")
            .replace("Mobile", "");
        settings.setUserAgentString(desktopUa + " ECBAndroidApp/" + BuildConfig.VERSION_NAME);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setHorizontalScrollBarEnabled(false);
        webView.setVerticalScrollBarEnabled(true);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        SwipeRefreshLayout refresher = new SwipeRefreshLayout(this);
        refresher.setOnRefreshListener(() -> webView.reload());

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            @RequiresApi(21)
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())) {
                    String path = uri.getPath() == null ? "/" : uri.getPath();
                    if (path.startsWith("/api/")) return null;
                    WebResourceResponse response = serveLocalAsset(path);
                    if (response != null) return response;
                    return assetLoader.shouldInterceptRequest(Uri.parse(LOCAL_APP_URL));
                }
                return assetLoader.shouldInterceptRequest(uri);
            }

            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if ("appassets.androidplatform.net".equals(uri.getHost())) {
                    String path = uri.getPath() == null ? "/" : uri.getPath();
                    if (path.startsWith("/api/")) return null;
                    WebResourceResponse response = serveLocalAsset(path);
                    if (response != null) return response;
                    return assetLoader.shouldInterceptRequest(Uri.parse(LOCAL_APP_URL));
                }
                return assetLoader.shouldInterceptRequest(uri);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                refresher.setRefreshing(false);
                view.setInitialScale(55);

                // The bundled web client may have an older browser fallback
                // version. Always make the Android APK's own release version
                // authoritative in the visible footer and DOM metadata.
                String version = BuildConfig.VERSION_NAME.replace("'", "");
                String script =
                    "(function(){"
                    + "var version='" + version + "';"
                    + "var m=document.querySelector('meta[name=viewport]');"
                    + "if(m){m.setAttribute('content','width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');}"
                    + "window.ECB_ANDROID_APP_VERSION=version;"
                    + "function sync(){"
                    + "document.querySelectorAll('[data-app-version]').forEach(function(el){"
                    + "el.setAttribute('data-app-version',version);"
                    + "var s=el.querySelector('span');"
                    + "if(s)s.textContent='App version '+version;"
                    + "});"
                    + "document.querySelectorAll('span').forEach(function(s){"
                    + "if((s.textContent||'').trim().toLowerCase().indexOf('app version')===0)s.textContent='App version '+version;"
                    + "});"
                    + "}"
                    + "sync();"
                    + "if(document.body&&!window.__ecbVersionObserver){"
                    + "window.__ecbVersionObserver=new MutationObserver(sync);"
                    + "window.__ecbVersionObserver.observe(document.body,{childList:true,subtree:true});"
                    + "}"
                    + "})();";
                view.evaluateJavascript(script, null);
            }
        });

        refresher.addView(webView, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ));

        FrameLayout root = new FrameLayout(this);
        root.addView(refresher);

        ImageView homeLogo = new ImageView(this);
        homeLogo.setImageResource(R.drawable.site_logo);
        homeLogo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        homeLogo.setContentDescription("Go to E-Football home");
        homeLogo.setClickable(true);
        homeLogo.setFocusable(true);
        homeLogo.setOnClickListener(v -> webView.loadUrl(LOCAL_APP_URL));
        int logoSize = (int) (160 * getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams logoParams = new FrameLayout.LayoutParams(
            logoSize, logoSize, Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM
        );
        logoParams.bottomMargin = (int) (120 * getResources().getDisplayMetrics().density);
        root.addView(homeLogo, logoParams);

        setContentView(root);
        webView.loadUrl(LOCAL_APP_URL);

        UpdateChecker.check(this, true);
        updateHandler.post(updatePoll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        UpdateChecker.check(this, true);
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
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}