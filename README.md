# Video Reaction App
A suite of tools to allow content creators to react to their favourite media without the stress of worrying about copyright claims.

## Concept
This app is built upon the idea of rather than screen recording copyright material, record the *inputs* to the video player of the copyrighted material.

This app is comprised of two main tools; namely, the recording app, and the playback app.

### Recording App
This app listens to OBS as well as the first video element found on the current webpage and waits until OBS sends an event stating that it's recording.
When this happens, each event (play / pause / seek) will be registered alongside a timestamp.

Once the recording has completed, these events will be serialised to a JSON file, ready for the playback app.

### Playback App
This app communicates across two tabs; the reaction tab, and the media tab.
In the reaction tab, the user loads up a reaction file recorded via the recording app.

Meanwhile, in the media tab, the user registers which video element (if multiple) should be used for playback events.

When the reaction tab video plays, the media tab immediately starts reading the events as recorded, and firing off events in the same order as recorded.