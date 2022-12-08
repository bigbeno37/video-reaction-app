import {z} from "zod";

export const InitialVideoConditionsSchema = z.object({
    videoTime: z.number(),
    paused: z.boolean(),
    playbackRate: z.number()
});

export type InitialVideoConditions = z.infer<typeof InitialVideoConditionsSchema>;

const PlayEventSchema = z.object({
    type: z.literal('PLAY'),
    videoTime: z.number(),
    realTime: z.number()
});

const PauseEventSchema = z.object({
    type: z.literal('PAUSE'),
    videoTime: z.number(),
    realTime: z.number()
});

export const VideoPlaybackEventSchema = z.discriminatedUnion("type", [
    PlayEventSchema,
    PauseEventSchema
]);

export type VideoPlaybackEvent = z.infer<typeof VideoPlaybackEventSchema>;

export const SerialisedVideoPlaybackSchema = z.object({
    timestamp: z.string(),
    schemaVersion: z.literal('1'),
    initialVideoConditions: InitialVideoConditionsSchema,
    actions: z.array(VideoPlaybackEventSchema)
});

export type SerialisedVideoPlayback = z.infer<typeof SerialisedVideoPlaybackSchema>;