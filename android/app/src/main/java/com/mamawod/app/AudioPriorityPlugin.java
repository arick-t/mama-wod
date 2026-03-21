package com.mamawod.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AudioPriority")
public class AudioPriorityPlugin extends Plugin {
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private boolean active = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void setActive(PluginCall call) {
        boolean wantActive = call.getBoolean("active", false);
        boolean ok = wantActive ? requestFocus() : abandonFocus();
        JSObject out = new JSObject();
        out.put("ok", ok);
        out.put("active", active);
        call.resolve(out);
    }

    @PluginMethod
    public void playCue(PluginCall call) {
        String type = call.getString("type", "beep");
        boolean focusOk = requestFocus();
        playNativeTone(type);

        // TRANSIENT_EXCLUSIVE: stronger than TRANSIENT — many music apps pause/duck more reliably (e.g. Spotify).
        mainHandler.postDelayed(this::abandonFocus, 2000);

        JSObject out = new JSObject();
        out.put("ok", focusOk);
        out.put("played", true);
        out.put("type", type);
        call.resolve(out);
    }

    private void playNativeTone(String type) {
        // Notification stream often sits above ducked music volume-wise vs STREAM_MUSIC.
        int stream = AudioManager.STREAM_NOTIFICATION;
        int volume = 100;
        int toneType = ToneGenerator.TONE_PROP_BEEP2;
        int durationMs = 140;

        if ("tick".equals(type)) {
            toneType = ToneGenerator.TONE_PROP_BEEP2;
            durationMs = 90;
        } else if ("bell".equals(type)) {
            toneType = ToneGenerator.TONE_PROP_ACK;
            durationMs = 240;
        } else if ("whistle".equals(type)) {
            toneType = ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD;
            durationMs = 320;
        }

        try {
            ToneGenerator tg = new ToneGenerator(stream, volume);
            tg.startTone(toneType, durationMs);
            mainHandler.postDelayed(tg::release, Math.max(500, durationMs + 220));
        } catch (Exception ignored) {
        }
    }

    private boolean requestFocus() {
        if (active) return true;
        if (audioManager == null) {
            audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        }
        if (audioManager == null) return false;

        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest == null) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(false)
                    .setWillPauseWhenDucked(false)
                    .build();
            }
            result = audioManager.requestAudioFocus(focusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                null,
                AudioManager.STREAM_NOTIFICATION,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
            );
        }
        active = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        return active;
    }

    private boolean abandonFocus() {
        if (!active) return true;
        if (audioManager == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
        } else {
            audioManager.abandonAudioFocus(null);
        }
        active = false;
        return true;
    }
}
