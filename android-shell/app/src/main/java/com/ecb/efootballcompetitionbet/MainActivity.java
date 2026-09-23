package com.ecb.efootballcompetitionbet;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.graphics.Outline;
import android.view.MotionEvent;
import android.graphics.drawable.GradientDrawable;
import android.widget.ImageView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://lslonlinebetting.lovable.app/";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2001;
    private static final String NOTIFICATION_CHANNEL_ID = "ecb_updates";
    private SwipeRefreshLayout swipeRefresh;
    private WebView webView;
    private View startupOverlay;
    private final Handler updateHandler = new Handler(Looper.getMainLooper());
    private final Runnable updatePoll = new Runnable() {
        @Override public void run() {
            UpdateChecker.check(MainActivity.this);
            updateHandler.postDelayed(this, 3000L);
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);

        getWindow().setStatusBarColor(0xFF080808);
        getWindow().setNavigationBarColor(0xFF080808);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF080808);

        // Branded in-app splash: larger than the Android 12 system icon so the
        // complete E-Football logo is clearly visible while the WebView starts.
        FrameLayout splash = new FrameLayout(this);
        splash.setBackgroundColor(0xFF080F1C);
        ImageView splashLogo = new ImageView(this);
        splashLogo.setImageResource(R.drawable.site_logo);
        splashLogo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        splashLogo.setAdjustViewBounds(true);
        splashLogo.setElevation(12 * getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams splashLogoParams = new FrameLayout.LayoutParams(
            (int)(260 * getResources().getDisplayMetrics().density),
            (int)(260 * getResources().getDisplayMetrics().density),
            Gravity.CENTER
        );
        splash.addView(splashLogo, splashLogoParams);
        root.addView(splash, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
        ));

        swipeRefresh = new SwipeRefreshLayout(this);
        swipeRefresh.setColorSchemeColors(0xFFFFC400);
        swipeRefresh.setEnabled(false);

        ViewCompat.setOnApplyWindowInsetsListener(swipeRefresh, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(0, bars.top, 0, bars.bottom);
            return insets;
        });

        webView = new WebView(this);
        webView.addJavascriptInterface(new NativeNotificationBridge(this), "ECBAndroid");
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        // Use the website's normal responsive mobile layout across the entire app.
        // Do not force a desktop CSS viewport or a fixed native zoom.
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
        s.setTextZoom(100);

        // Start slightly zoomed out, while allowing native pinch-to-zoom.
        // Users can pinch in/out freely; the initial presentation remains compact.
        webView.setInitialScale(85);
        s.setSupportZoom(true);
        s.setSupportMultipleWindows(false);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setBuiltInZoomControls(true);

        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Keep the normal Android WebView/mobile user agent so the website
        // serves its responsive mobile layout, while retaining the app marker
        // used by the live update gate.
        s.setUserAgentString(s.getUserAgentString() + " ECBAndroidApp/" + BuildConfig.VERSION_NAME);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setOnTouchListener((v, event) -> {
            if (event.getPointerCount() > 1) {
                swipeRefresh.setEnabled(false);
            } else if (event.getActionMasked() == MotionEvent.ACTION_UP || event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
                swipeRefresh.setEnabled(true);
            }
            return false;
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && url.matches("(?i).*\\.apk(?:[?#].*)?$")) {
                    UpdateChecker.downloadAndInstallFromUrl(MainActivity.this, url);
                    return true;
                }
                return false;
            }

            @Override public void onPageFinished(WebView view, String url) {
                // The currently deployed web updater uses window.open() for the
                // APK URL. Force APK opens into the same WebView navigation so
                // the DownloadListener below can hand the file to the native
                // installer, without changing normal website links.
                view.evaluateJavascript(
                    "(function(){"
                    + "if(window.__ecbApkOpenPatched)return;"
                    + "var original=window.open;"
                    + "window.open=function(url){"
                    + "if(typeof url==='string' && /\\.apk(?:[?#]|$)/i.test(url)){window.location.href=url;return null;}"
                    + "return original.apply(window,arguments);"
                    + "};"
                    + "window.__ecbApkOpenPatched=true;"
                    + "})();",
                    null
                );
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                if (startupOverlay != null) { startupOverlay.animate().alpha(0f).setDuration(220).withEndAction(() -> { if (startupOverlay != null) { ((FrameLayout) startupOverlay.getParent()).removeView(startupOverlay); startupOverlay = null; } }).start(); }
                if (splash.getVisibility() == View.VISIBLE) {
                    splash.animate().alpha(0f).setDuration(260L).withEndAction(() -> splash.setVisibility(View.GONE)).start();
                }
                view.evaluateJavascript(
                    "(function(){var m=document.querySelector('meta[name=viewport]');if(m)m.setAttribute('content','width=device-width,initial-scale=0.85,minimum-scale=0.5,maximum-scale=4,user-scalable=yes,viewport-fit=cover');})();",
                    null
                );
            }
        });

        // New builds can receive the website update popup and route its APK
        // download directly into the native Android downloader/installer.
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
            UpdateChecker.downloadAndInstallFromUrl(MainActivity.this, url));

        swipeRefresh.setOnChildScrollUpCallback((parent, child) -> webView != null && webView.canScrollVertically(-1));

        swipeRefresh.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        root.addView(swipeRefresh, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // Compact premium home control with transparent logo surface.
        float d = getResources().getDisplayMetrics().density;
        FrameLayout homeControl = new FrameLayout(this);
        GradientDrawable homeRing = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{0xFFF9DE7A, 0xFFD4AF37, 0xFF8B6510}
        );
        homeRing.setShape(GradientDrawable.OVAL);
        homeRing.setStroke((int) (1.2f * d), 0xFFFFF0B0);
        homeControl.setBackground(homeRing);
        homeControl.setElevation(12 * d);
        homeControl.setClickable(true);
        homeControl.setFocusable(true);
        homeControl.setContentDescription("Go to E-Football home");
        homeControl.setOnClickListener(v -> webView.loadUrl(APP_URL));

        ImageView homeLogo = new ImageView(this);
        homeLogo.setImageResource(R.drawable.site_logo);
        homeLogo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        homeLogo.setPadding((int)(6*d),(int)(6*d),(int)(6*d),(int)(6*d));
        homeLogo.setBackgroundColor(0x00000000);
        homeLogo.setClipToOutline(true);
        homeControl.addView(homeLogo, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
        ));
        FrameLayout.LayoutParams homeParams = new FrameLayout.LayoutParams(
            (int)(44*d), (int)(44*d), Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM
        );
        homeParams.bottomMargin = (int)(8*d);
        root.addView(homeControl, homeParams);

        // Large branded startup overlay until the first web page is ready.
        startupOverlay = new FrameLayout(this);
        startupOverlay.setBackgroundColor(0xFF08111F);
        ImageView startupLogo = new ImageView(this);
        startupLogo.setImageResource(R.drawable.site_logo);
        startupLogo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        startupLogo.setAdjustViewBounds(true);
        startupLogo.setPadding((int)(12*d),(int)(12*d),(int)(12*d),(int)(12*d));
        startupOverlay.addView(startupLogo, new FrameLayout.LayoutParams(
            (int)(250*d), (int)(250*d), Gravity.CENTER
        ));
        root.addView(startupOverlay, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
        ));
        startupOverlay.bringToFront();

        setContentView(root);
        webView.loadUrl(APP_URL);

        createNotificationChannel();
        requestNotificationPermissionIfNeeded();
        UpdateChecker.check(this);
        root.postDelayed(() -> UpdateChecker.check(this), 5000L);
        updateHandler.postDelayed(updatePoll, 3000L);
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
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        UpdateChecker.check(this);
        updateHandler.removeCallbacks(updatePoll);
        updateHandler.post(updatePoll);
    }

    @Override protected void onDestroy() {
        updateHandler.removeCallbacks(updatePoll);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override protected void onPause() {
        updateHandler.removeCallbacks(updatePoll);
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}