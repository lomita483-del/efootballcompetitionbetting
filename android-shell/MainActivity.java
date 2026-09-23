package com.ecb.efootballcompetitionbet;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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

        // Match the site's desktop/admin layout instead of forcing a
        // phone-width responsive layout. The page gets a fixed desktop
        // viewport and starts at 100%, so it is not automatically shrunk.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        webView.setInitialScale(100);

        // Lock the page at the chosen scale. No pinch or browser zoom.
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);

        settings.setUserAgentString(
            settings.getUserAgentString() + " ECBAndroidApp/" + BuildConfig.VERSION_NAME
        );

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                // Use a desktop/admin-style viewport and preserve the site's
                // desktop CSS instead of forcing mobile-width CSS.
                String script =
                    "(function(){"
                    + "var m=document.querySelector('meta[name=viewport]');"
                    + "if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}"
                    + "m.setAttribute('content','width=1024,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no');"
                    + "var s=document.getElementById('ecb-mobile-stability');"
                    + "if(!s){s=document.createElement('style');s.id='ecb-mobile-stability';"
                    + "s.textContent='html,body{min-width:1024px;margin:0;padding:0}body{-webkit-text-size-adjust:100%;overscroll-behavior-x:none}';"
                    + "document.head.appendChild(s);}"
                    + "})();";
                view.evaluateJavascript(script, null);
            }
        });

        // Keep the desktop layout stable. Horizontal scrolling is available
        // when the desktop canvas is wider than the phone; zoom remains locked.
        webView.setHorizontalScrollBarEnabled(false);
        webView.setVerticalScrollBarEnabled(true);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        setContentView(webView);
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
