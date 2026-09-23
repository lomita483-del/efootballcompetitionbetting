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

        // Use the real phone-width viewport and start slightly enlarged.
        // Android documents that overview mode is what zooms wide content out;
        // keep it off and explicitly start at 125% for a more readable phone UI.
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);
        webView.setInitialScale(125);

        // Lock the scale after the initial 125% setting.
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
                // Force a mobile viewport and prevent horizontal page drift.
                String script =
                    "(function(){"
                    + "var m=document.querySelector('meta[name=viewport]');"
                    + "if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}"
                    + "m.setAttribute('content','width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover');"
                    + "var s=document.getElementById('ecb-mobile-stability');"
                    + "if(!s){s=document.createElement('style');s.id='ecb-mobile-stability';"
                    + "s.textContent='html,body{width:100%;max-width:100%;min-width:0!important;overflow-x:hidden!important;margin:0;padding:0}"
                    + "#root{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important}"
                    + "body{-webkit-text-size-adjust:100%;overscroll-behavior-x:none}"
                    + "*,*::before,*::after{box-sizing:border-box}';"
                    + "document.head.appendChild(s);}"
                    + "})();";
                view.evaluateJavascript(script, null);
            }
        });

        // No sideways scrolling/overscroll. Vertical scrolling remains normal.
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
