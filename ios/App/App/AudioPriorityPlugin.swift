import Foundation
import Capacitor
import AVFoundation
/// Timer cues play through AVAudioEngine so they honor AVAudioSession and can duck
/// background apps (e.g. Spotify). System sounds (`AudioServicesPlaySystemSound`) often
/// do not participate in ducking the same way.
@objc(AudioPriorityPlugin)
public class AudioPriorityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioPriorityPlugin"
    public let jsName = "AudioPriority"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setActive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playCue", returnType: CAPPluginReturnPromise)
    ]

    private var cueEngine: AVAudioEngine?
    private var cuePlayer: AVAudioPlayerNode?
    private let cueSampleRate: Double = 44_100

    @objc func setActive(_ call: CAPPluginCall) {
        let active = call.getBool("active") ?? false
        let session = AVAudioSession.sharedInstance()
        do {
            if active {
                // duckOthers only — mixWithOthers would let Spotify stay at full volume.
                try session.setCategory(.playback, mode: .default, options: [.duckOthers])
                try session.setActive(true, options: [])
            } else {
                try session.setActive(false, options: [.notifyOthersOnDeactivation])
            }
            call.resolve([
                "ok": true,
                "active": active
            ])
        } catch {
            call.resolve([
                "ok": false,
                "active": false,
                "error": error.localizedDescription
            ])
        }
    }

    @objc func playCue(_ call: CAPPluginCall) {
        let type = call.getString("type") ?? "beep"
        stopCuePlayback()

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [.duckOthers])
            try session.setActive(true, options: [])
        } catch {
            call.resolve([
                "ok": false,
                "played": false,
                "error": error.localizedDescription
            ])
            return
        }

        let buffers: [(frequency: Double, duration: TimeInterval, volume: Float)]
        switch type {
        case "tick":
            buffers = [(frequency: 900, duration: 0.07, volume: 0.75)]
        case "whistle":
            buffers = [
                (frequency: 2400, duration: 0.18, volume: 0.82),
                (frequency: 2800, duration: 0.22, volume: 0.82)
            ]
        case "bell":
            buffers = [(frequency: 880, duration: 0.5, volume: 0.78)]
        default:
            buffers = [(frequency: 440, duration: 0.32, volume: 0.8)]
        }

        guard let format = AVAudioFormat(standardFormatWithSampleRate: cueSampleRate, channels: 1) else {
            call.resolve(["ok": false, "played": false, "error": "format"])
            return
        }

        var pcmBuffers: [AVAudioPCMBuffer] = []
        var totalDuration: TimeInterval = 0
        for b in buffers {
            if let buf = makeSineBuffer(frequency: b.frequency, duration: b.duration, volume: b.volume, format: format) {
                pcmBuffers.append(buf)
                totalDuration += b.duration
            }
        }
        guard !pcmBuffers.isEmpty else {
            try? session.setActive(false, options: [.notifyOthersOnDeactivation])
            call.resolve(["ok": false, "played": false, "error": "no_buffers"])
            return
        }

        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        engine.mainMixerNode.outputVolume = 1.0

        do {
            try engine.start()
            self.cueEngine = engine
            self.cuePlayer = player
            let lastIdx = pcmBuffers.count - 1
            for (i, buf) in pcmBuffers.enumerated() {
                player.scheduleBuffer(buf) { [weak self] in
                    if i == lastIdx {
                        DispatchQueue.main.async {
                            self?.deactivateSessionAfterCue()
                        }
                    }
                }
            }
            player.play()
        } catch {
            try? session.setActive(false, options: [.notifyOthersOnDeactivation])
            call.resolve(["ok": false, "played": false, "error": error.localizedDescription])
            return
        }

        // Safety: ensure session cleanup if completion never runs
        let deactivateDelay = max(totalDuration + 0.55, 1.1)
        DispatchQueue.main.asyncAfter(deadline: .now() + deactivateDelay) { [weak self] in
            self?.deactivateSessionAfterCue()
        }

        call.resolve([
            "ok": true,
            "played": true,
            "type": type
        ])
    }

    private func makeSineBuffer(frequency: Double, duration: TimeInterval, volume: Float, format: AVAudioFormat) -> AVAudioPCMBuffer? {
        let frameCount = AVAudioFrameCount(duration * cueSampleRate)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount
        guard let data = buffer.floatChannelData?[0] else { return nil }
        let twoPi = 2.0 * Double.pi
        let attack = min(Int(cueSampleRate * 0.004), Int(frameCount) / 4)
        let release = min(Int(cueSampleRate * 0.025), Int(frameCount) / 3)
        for i in 0..<Int(frameCount) {
            let t = Double(i) / cueSampleRate
            var env = 1.0
            if i < attack && attack > 0 {
                env = Double(i) / Double(attack)
            } else if i > Int(frameCount) - release && release > 0 {
                env = Double(Int(frameCount) - i) / Double(release)
            }
            data[i] = Float(sin(twoPi * frequency * t) * Double(volume) * env)
        }
        return buffer
    }

    private func stopCuePlayback() {
        cuePlayer?.stop()
        cueEngine?.stop()
        cueEngine?.reset()
        cuePlayer = nil
        cueEngine = nil
    }

    private func deactivateSessionAfterCue() {
        stopCuePlayback()
        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false, options: [.notifyOthersOnDeactivation])
    }
}
