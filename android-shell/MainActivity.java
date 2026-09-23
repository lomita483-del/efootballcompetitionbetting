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

        // Render the website like the desktop/admin console. Do not use
        // phone-width responsive scaling and do not zoom the whole page.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        webView.setInitialScale(100);

        // Keep the website at its normal CSS scale. No pinch/accidental zoom.
        settings.setSupportZoom(false);
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

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                // Match the admin/desktop canvas. Crucially, do not inject a
                // device-width viewport or any CSS that scales the whole page.
                String script =
                    "(function(){"
                    + "var m=document.querySelector('meta[name=viewport]');"
                    + "if(m){m.setAttribute('content','width=1024,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no');}"
                    + "var s=document.getElementById('ecb-admin-scale');"
                    + "if(!s){s=document.createElement('style');s.id='ecb-admin-scale';"
                    + "s.textContent='body{-webkit-text-size-adjust:100%;overscroll-behavior-x:none}';"
                    + "document.head.appendChild(s);}"
                    + "})();";
                view.evaluateJavascript(script, null);
            }
        });

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
