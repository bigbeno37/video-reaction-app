import OBSWebSocket from "obs-websocket-js";
import {Err, intoAsyncResult, Ok, querySelector, Result} from "safer-ts";
import type {InitialVideoConditions, SerialisedVideoPlayback, VideoPlaybackEvent} from "../shared/types";
import FileSaver from "file-saver";

const obs = new OBSWebSocket();

const log = (...messages: any[]) => console.log('[REACTION RECORDING APP]', ...messages);

const untilOk = <T, E>(fn: () => Result<T, E> | Promise<Result<T, E>>, config: { delay: number, onError?: (error: E) => void } = { delay: 1000 }): Promise<T> => {
    return new Promise(resolve => {
        const repeat = async () => {
            const result = await fn();

            if (result.isOk()) {
                return resolve(result.unwrap());
            } else {
                if (config.onError) config.onError(result.unwrapErr());

                setTimeout(repeat, config.delay);
            }
        };

        repeat().then();
    });
}

const connectToOBS = () => {
    log('Connecting to OBS...');

    untilOk(() => intoAsyncResult(obs.connect()), { delay: 5000, onError: () => log('Unable to connect to OBS, retrying in 5000ms...') })
        .then(() => log('Connected to OBS! Looking for video...'))
        .then(() => untilOk(() =>
            querySelector('video')
                .okOr({})
                .andThen(element => element instanceof HTMLVideoElement ? Ok(element) : Err<{}, HTMLVideoElement>({})),
            {
                delay: 1000,
                onError: () => log('Unable to find video element! Trying again in 1000ms...')
            })
        )
        .then(video => {
            log('Found video element!');

            let events: VideoPlaybackEvent[] = [];
            let initialVideoConditions: InitialVideoConditions;
            let isRecording = false;
            let initialTime = 0;

            let isPaused = true;
            const addPauseEvent = () => {
                isPaused = true;

                events.push({
                    type: 'PAUSE',
                    videoTime: video.currentTime,
                    realTime: performance.now() - initialTime
                });

                log('Recorded PAUSE event');
            };

            const addPlayEvent = () => {
                if (!isPaused) return;

                isPaused = false;
                events.push({
                    type: 'PLAY',
                    videoTime: video.currentTime,
                    realTime: performance.now() - initialTime
                });

                log('Recorded PLAY event');
            };

            const ifRecording = (fn: () => void) => () => {
                if (isRecording) fn();
            };

            video.addEventListener('pause', ifRecording(addPauseEvent));
            video.addEventListener('seeking', ifRecording(addPauseEvent));
            video.addEventListener('seeked', ifRecording(addPauseEvent));
            video.addEventListener('timeupdate', ifRecording(addPlayEvent));

            obs.on('RecordStateChanged', ev => {
                log('Received event from OBS', ev.outputState);

                switch (ev.outputState) {
                    case "OBS_WEBSOCKET_OUTPUT_STARTED":
                        log('Recording started...');

                        events = [];
                        isRecording = true;
                        initialTime = performance.now();
                        initialVideoConditions = {
                            videoTime: video.currentTime,
                            paused: video.paused,
                            playbackRate: video.playbackRate
                        };

                        break;
                    case "OBS_WEBSOCKET_OUTPUT_STOPPED":
                        log('Recording finished. Wrapping up...');

                        isRecording = false;

                        const data: SerialisedVideoPlayback = {
                            schemaVersion: '1',
                            timestamp: new Date().toISOString(),
                            initialVideoConditions,
                            actions: events
                        };

                        const filename = (ev as unknown as {outputPath: string}).outputPath.replace(/^.+?\\/g, '').replace(/\.[0-9a-zA-Z]+?$/g, '.json');

                        const blob = new Blob([JSON.stringify(data)], {type: 'application/json;charset=utf-8'});
                        FileSaver.saveAs(blob, filename);
                }
            });

            log('Ready!');
        });
};

log('App running...');

connectToOBS();