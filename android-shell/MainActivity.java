package com.ecb.efootballcompetitionbet;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Color;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://lslonlinebetting.lovable.app/";
    private WebView webView;

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

        // Render the website like the desktop/admin console. Do not use
        // phone-width responsive scaling and do not zoom the whole page.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        webView.setInitialScale(80);

        // Keep the website at its normal 80% presentation while allowing pinch zoom for accessibility.
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);

        // Do not advertise this shell as a mobile browser. This prevents the
        // site's mobile CSS breakpoint from shrinking/rearranging the page.
        String desktopUa = settings.getUserAgentString()
            .replace(" Mobile", "")
            .replace("Mobile", "");
        settings.setUserAgentString(desktopUa + " ECBAndroidApp/" + BuildConfig.VERSION_NAME);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setHorizontalScrollBarEnabled(false);
        webView.setVerticalScrollBarEnabled(true);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

        // Pull-to-refresh only activates when the WebView is already at the top.
        SwipeRefreshLayout refresher = new SwipeRefreshLayout(this);
        refresher.setOnRefreshListener(() -> webView.reload());

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                refresher.setRefreshing(false);
                String script =
                    "(function(){"
                    + "var m=document.querySelector('meta[name=viewport]');"
                    + "if(m){m.setAttribute('content','width=1024,initial-scale=1.0,minimum-scale=0.5,maximum-scale=5.0,user-scalable=yes');}"
                    + "var s=document.getElementById('ecb-admin-scale');"
                    + "if(!s){s=document.createElement('style');s.id='ecb-admin-scale';"
                    + "s.textContent='body{-webkit-text-size-adjust:100%;overscroll-behavior-x:none;overscroll-behavior-y:auto}';"
                    + "document.head.appendChild(s);}"
                    + "})();";
                view.evaluateJavascript(script, null);
            }
        });
        refresher.addView(webView, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ));

        FrameLayout root = new FrameLayout(this);
        root.addView(refresher);

        // Fixed, non-draggable website logo. Clicking it always returns home.
        ImageView homeLogo = new ImageView(this);
        homeLogo.setImageResource(R.drawable.site_logo);
        homeLogo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        homeLogo.setContentDescription("Go to E-Football home");
        homeLogo.setClickable(true);
        homeLogo.setFocusable(true);
        homeLogo.setOnClickListener(v -> webView.loadUrl(APP_URL));
        int logoSize = (int) (220 * getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams logoParams = new FrameLayout.LayoutParams(
            logoSize, logoSize, Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM
        );
        logoParams.bottomMargin = (int) (120 * getResources().getDisplayMetrics().density);
        root.addView(homeLogo, logoParams);

        setContentView(root);
        webView.loadUrl(APP_URL);

        UpdateChecker.check(this, false);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        UpdateChecker.check(this, false);
    }

    @Override
    protected void onPause() {
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
