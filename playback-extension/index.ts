import {runtime, tabs, windows} from "webextension-polyfill";
import {z} from "zod";
import {SerialisedVideoPlayback, SerialisedVideoPlaybackSchema, VideoPlaybackEvent} from "../shared/types";

const port = runtime.connect({ name: 'test' });

const log = (...messages: any[]) => console.log('[REACTION PLAYER EXTENSION]', ...messages);
const warn = (...messages: any[]) => console.warn('[REACTION PLAYER EXTENSION]', ...messages);
const error = (...messages: any[]) => console.error('[REACTION PLAYER EXTENSION]', ...messages);

log('Running...');

const RegisterAsReactionPlayerSchema = z.object({
    type: z.literal('REGISTER_AS_REACTION_PLAYER')
});

const RegisterAsMediaPlayerSchema = z.object({
    type: z.literal('REGISTER_AS_MEDIA_PLAYER')
});

const LoadVideoPlaybackEventsSchema = z.object({
    type: z.literal('LOAD_VIDEO_PLAYBACK_EVENTS'),
    data: SerialisedVideoPlaybackSchema
});

const PlaySchema = z.object({
    type: z.literal('PLAY')
});

const PlaybackExtensionEventSchema = z.discriminatedUnion("type", [
    RegisterAsReactionPlayerSchema,
    RegisterAsMediaPlayerSchema,
    LoadVideoPlaybackEventsSchema,
    PlaySchema
]);

type PlaybackExtensionEvent = z.infer<typeof PlaybackExtensionEventSchema>;

const post = (event: PlaybackExtensionEvent) => {
    log('Posting', event);
    port.postMessage(event);
}

window.addEventListener('message', ({data}) => {
    console.log(new Date().toISOString());
    port.postMessage(data);

});

let isMediaPlayer = false;
let isReactionPlayer = false;
let playbackEvents: SerialisedVideoPlayback;

const handlePlayAsReactionPlayer = () => {
    const video = document.querySelector("video");

    if (!video) {
        error('Unable to find video element! Stopping...');
        return;
    }

    video.play();
};

const handlePlayAsMediaPlayer = () => {
    if (!playbackEvents) {
        error('Unable to initialise playback! No data present!');
        return;
    }

    const video = document.querySelector("video");

    if (!video) {
        error('Unable to find video element! Stopping...');
        return;
    }

    const { initialVideoConditions } = playbackEvents;

    video.currentTime = initialVideoConditions.videoTime;
    video.playbackRate = initialVideoConditions.playbackRate;
    if (initialVideoConditions.paused) {
        video.pause();
    } else {
        video.play();
    }

    let i = 0;
    let initialDelta = -1;
    const raf = async (delta: number) => {
        if (initialDelta === -1) {
            initialDelta = delta;
        }

        const currentTime = delta - initialDelta;

        while (playbackEvents.actions[i].realTime <= currentTime) {
            const action = playbackEvents.actions[i];
            log('Handling playback event', action);

            switch (action.type) {
                case "PLAY":
                    video.currentTime = action.videoTime;
                    await video.play();
                    break;
                case "PAUSE":
                    video.currentTime = action.videoTime;
                    video.pause();
                    break;
            }

            i++;

            if (i >= playbackEvents.actions.length) {
                log('Reached end of events.');
                break;
            }
        }

        if (i >= playbackEvents.actions.length) {
            video.pause();
        } else {
            requestAnimationFrame(raf);
        }
    };

    requestAnimationFrame(raf);
};

port.onMessage.addListener((ev) => {
    log('Received message', ev);

    const result = PlaybackExtensionEventSchema.safeParse(ev);
    if (!result.success) {
        console.log('Received invalid data from port!');
        return;
    }

    switch (result.data.type) {
        case "REGISTER_AS_MEDIA_PLAYER":
            if (isReactionPlayer) {
                warn('Was already registered as reaction player. Changing to media player...');
                isReactionPlayer = false;
            }

            if (isMediaPlayer) {
                warn('Already registered as a media player. Continuing...');
            }

            isMediaPlayer = true;
            break;
        case "REGISTER_AS_REACTION_PLAYER":
            if (isMediaPlayer) {
                warn('Was already registered as media player. Changing to reaction player...');
                isReactionPlayer = false;
            }

            if (isReactionPlayer) {
                warn('Already registered as a reaction player. Continuing...');
            }

            isReactionPlayer = true;
            break;
        case "LOAD_VIDEO_PLAYBACK_EVENTS":
            playbackEvents = result.data.data;

            const video = document.querySelector("video");

            if (!video) {
                break;
            }

            const { initialVideoConditions } = playbackEvents;

            if (isMediaPlayer) {
                video.currentTime = initialVideoConditions.videoTime;
                video.playbackRate = initialVideoConditions.playbackRate;
            }

            break;
        case "PLAY":
            if (!isMediaPlayer && !isReactionPlayer) {
                error('Unable to play! Not registered as either media player or reaction player!');
                return;
            }

            if (isMediaPlayer) {
                handlePlayAsMediaPlayer();
            }

            if (isReactionPlayer) {
                handlePlayAsReactionPlayer();
            }
    }
});

const filePicker = document.querySelector("#file") as HTMLInputElement | undefined;
const reactionDataButton = document.querySelector("#reaction-data-btn");
const playButton = document.querySelector("#play");

if (filePicker && reactionDataButton && playButton) {
    log('Identified as reaction video tab!');

    filePicker.addEventListener('change', ev => {
        const file = (ev.target as HTMLInputElement).files![0];

        const reader = new FileReader();
        reader.addEventListener('load', ev => {
            const json = JSON.parse(ev.target!.result as string);
            const result = SerialisedVideoPlaybackSchema.safeParse(json);

            if (!result.success) {
                console.log('Invalid JSON!');
                return;
            }

            post({ type: 'LOAD_VIDEO_PLAYBACK_EVENTS', data: result.data });
        });
        reader.readAsText(file);
    });

    reactionDataButton.addEventListener('click', () => {
        (document.querySelector("#file") as HTMLInputElement).click();
    });

    playButton.addEventListener('click', () => {
        post({ type: 'PLAY' });
        handlePlayAsReactionPlayer();
    });

    isReactionPlayer = true;
    post({ type: 'REGISTER_AS_MEDIA_PLAYER' });
}