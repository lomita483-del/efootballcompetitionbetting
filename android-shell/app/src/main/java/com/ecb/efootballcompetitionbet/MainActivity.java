package com.ecb.efootballcompetitionbet;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.os.Handler;

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
    private final Handler updateHandler = new Handler();
    private final Runnable updatePoll = new Runnable() {
        @Override public void run() {
            UpdateChecker.check(MainActivity.this);
            updateHandler.postDelayed(this, 60_000L);
        }
    };

    @Override public void onCreate(Bundle state) {
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
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);

        // Render the website at 80% of the previous WebView scale.
        s.setTextZoom(100);
        webView.setInitialScale(80);

        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        String desktopChromeUa =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ECBAndroidApp/"
            + BuildConfig.VERSION_NAME;
        s.setUserAgentString(desktopChromeUa);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            private void applyPageScale(String url) {
                boolean isAdminConsole = url != null && (
                    url.contains("/admin") || url.contains("/admin/")
                );
                // SPA navigation does not always cause WebView's initial scale to
                // re-layout the already-rendered document. Keep the base scale at
                // 100% on admin routes and apply the requested 85% to the actual
                // document so floating checkout widgets scale with the console.
                webView.setInitialScale(isAdminConsole ? 100 : 80);
                webView.evaluateJavascript(
                    "(function(){document.documentElement.style.zoom='" + (isAdminConsole ? "85%" : "100%") + "';document.body.style.zoom='" + (isAdminConsole ? "85%" : "100%") + "';})();",
                    null
                );
            }

            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                applyPageScale(url);
            }

            @Override public void onPageFinished(WebView view, String url) {
                applyPageScale(url);
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
            }

            @Override public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                applyPageScale(url);
                super.doUpdateVisitedHistory(view, url, isReload);
            }
        });

        swipeRefresh.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        root.addView(swipeRefresh, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);
        webView.loadUrl(APP_URL);

        createNotificationChannel();
        requestNotificationPermissionIfNeeded();
        UpdateChecker.check(this);
        root.postDelayed(() -> UpdateChecker.check(this), 5000L);
        updateHandler.postDelayed(updatePoll, 60_000L);
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
    }

    @Override protected void onDestroy() {
        updateHandler.removeCallbacks(updatePoll);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}