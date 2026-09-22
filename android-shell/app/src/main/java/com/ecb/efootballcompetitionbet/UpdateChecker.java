package com.ecb.efootballcompetitionbet;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public final class UpdateChecker {
    private static final String MANIFEST = "https://raw.githubusercontent.com/lomita483-del/efootballcompetitionbet/main/public/app-release.json";
    private static boolean showing;
    private UpdateChecker() {}

    public static void check(Activity a) {
        if (a == null || a.isFinishing() || showing) return;
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection)new URL(MANIFEST + "?t=" + System.currentTimeMillis()).openConnection();
                c.setConnectTimeout(7000); c.setReadTimeout(7000); c.setUseCaches(false);
                c.setRequestProperty("Cache-Control","no-cache, no-store");
                if (c.getResponseCode() != 200) return;
                BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()));
                StringBuilder b = new StringBuilder(); String line;
                while ((line=r.readLine()) != null) b.append(line);
                c.disconnect();
                JSONObject j = new JSONObject(b.toString());
                int latest = j.optInt("latestBuild",0), min = j.optInt("minimumSupportedBuild",0);
                if (latest <= BuildConfig.VERSION_CODE) return;
                String version=j.optString("latestVersion",""), url=j.optString("downloadUrl","");
                boolean mandatory=j.optBoolean("forceUpdate",false) || (min>0 && BuildConfig.VERSION_CODE<min);
                String notes=j.optString("releaseNotes","").replace("[","").replace("]","");
                a.runOnUiThread(() -> {
                    if (a.isFinishing() || showing) return;
                    showing=true;
                    AlertDialog d=new AlertDialog.Builder(a)
                        .setTitle(mandatory ? "Update required" : "New update available")
                        .setMessage("Version "+version+" is ready.\n\n"+notes+"\n\nYour account data is kept by the app and is not cleared by an update.")
                        .setPositiveButton("Download update",(x,w)->{
                            if(!url.isEmpty()) a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        }).setCancelable(!mandatory).create();
                    d.setOnDismissListener(x -> showing=false);
                    d.show();
                });
            } catch(Exception ignored) {}
        }).start();
    }
}
