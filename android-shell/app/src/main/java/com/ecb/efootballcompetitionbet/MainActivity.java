package com.ecb.efootballcompetitionbet;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.FrameLayout;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://lslonlinebetting.lovable.app/";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2001;
    private static final String NOTIFICATION_CHANNEL_ID = "ecb_updates";
    private WebView webView;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);

        Window window = getWindow();
        window.setStatusBarColor(0xFF080808);
        window.setNavigationBarColor(0xFF080808);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF080808);
        root.setFitsSystemWindows(false);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);

        // Keep the desktop console layout, but make the fixed phone canvas readable.
        // 760px is intentionally between the old tiny 900px canvas and mobile mode.
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
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
        webView.setWebViewClient(new WebViewClient());

        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        root.setOnApplyWindowInsetsListener((View v, WindowInsets insets) -> {
            int top;
            int bottom;
            int left;
            int right;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(
                    WindowInsets.Type.statusBars()
                        | WindowInsets.Type.navigationBars()
                        | WindowInsets.Type.displayCutout()
                );
                top = bars.top;
                bottom = bars.bottom;
                left = bars.left;
                right = bars.right;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
                left = insets.getSystemWindowInsetLeft();
                right = insets.getSystemWindowInsetRight();
            }

            v.setPadding(left, top, right, bottom);
            return insets;
        });

        setContentView(root);
        root.post(root::requestApplyInsets);
        webView.loadUrl(APP_URL);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        }

        createNotificationChannel();
        requestNotificationPermissionIfNeeded();

        UpdateChecker.check(this);
        root.postDelayed(() -> UpdateChecker.check(this), 5000L);
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
        channel.setDescription("Match results, account alerts and important E-Football Competition Bet updates.");
        manager.createNotificationChannel(channel);
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        requestPermissions(
            new String[]{Manifest.permission.POST_NOTIFICATIONS},
            NOTIFICATION_PERMISSION_REQUEST
        );
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.requestApplyInsets();
        }
        UpdateChecker.check(this);
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
