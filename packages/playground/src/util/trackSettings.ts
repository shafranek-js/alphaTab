import type * as alphaTab from '@coderline/alphatab';

export function saveTrackSettings(api: alphaTab.AlphaTabApi): void {
    const score = api.score;
    if (!score) {
        return;
    }

    const tracks: any[] = [];
    const trackElements = document.querySelectorAll('.track-item');
    for (const el of trackElements) {
        const checkbox = el.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (!checkbox) continue;
        const index = Number(checkbox.id.replace('t-', ''));
        const track = score.tracks[index];
        if (!track) continue;

        const volumeEl = el.querySelector<HTMLInputElement>('.track-volume');
        const balanceEl = el.querySelector<HTMLInputElement>('.track-balance');
        const transposeAudioEl = el.querySelector<HTMLInputElement>('.track-transpose-audio');
        const selectEl = el.querySelector<HTMLSelectElement>('.track-instrument');
        const soloEl = el.querySelector<HTMLButtonElement>('.track-button.success');
        const muteEl = el.querySelector<HTMLButtonElement>('.track-button.danger');

        const staffElements = el.querySelectorAll('.track-staves > .settings-item');
        const staves: any[] = [];
        staffElements.forEach((staffEl, sIdx) => {
            const staff = track.staves[sIdx];
            if (!staff) return;
            const buttons = staffEl.querySelectorAll<HTMLButtonElement>('.staff-button');
            let showStandardNotation = staff.showStandardNotation;
            let showTablature = staff.showTablature;
            let showSlash = staff.showSlash;
            let showNumbered = staff.showNumbered;
            buttons.forEach(btn => {
                const opt = btn.dataset.option;
                const active = btn.classList.contains('active');
                if (opt === 'showStandardNotation') showStandardNotation = active;
                if (opt === 'showTablature') showTablature = active;
                if (opt === 'showSlash') showSlash = active;
                if (opt === 'showNumbered') showNumbered = active;
            });
            staves.push({
                index: staff.index,
                showStandardNotation,
                showTablature,
                showSlash,
                showNumbered
            });
        });

        tracks.push({
            index,
            volume: volumeEl ? volumeEl.valueAsNumber : track.playbackInfo.volume,
            balance: balanceEl ? balanceEl.valueAsNumber : track.playbackInfo.balance,
            isMute: muteEl ? muteEl.classList.contains('active') : track.playbackInfo.isMute,
            isSolo: soloEl ? soloEl.classList.contains('active') : track.playbackInfo.isSolo,
            transpositionPitch: transposeAudioEl ? transposeAudioEl.valueAsNumber : 0,
            program: selectEl ? Number(selectEl.value) : track.playbackInfo.program,
            staves
        });
    }

    const activeTracksElements = document.querySelectorAll<HTMLInputElement>('.track-item input[type="checkbox"]:checked');
    const activeTracks: number[] = [];
    activeTracksElements.forEach(checkbox => {
        activeTracks.push(Number(checkbox.id.replace('t-', '')));
    });

    const key = `${score.title}::${score.artist}`;
    const scoreSettings = {
        activeTracks,
        tracks
    };

    try {
        const allSettingsStr = typeof localStorage !== 'undefined' ? localStorage.getItem('at-playground-track-settings') : null;
        const allSettings = allSettingsStr ? JSON.parse(allSettingsStr) : {};
        allSettings[key] = scoreSettings;
        localStorage.setItem('at-playground-track-settings', JSON.stringify(allSettings));
    } catch (e) {
        console.error('Failed to save track settings:', e);
    }
}
