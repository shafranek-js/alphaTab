import {
    ArrowDownNarrowWide,
    BarChart3,
    ChevronDown,
    ChevronRight,
    Crop,
    Download,
    Drum,
    FileAudio,
    FolderOpen,
    Guitar,
    Headphones,
    Hourglass,
    ListChecks,
    MapPin,
    Menu,
    Metronome,
    Mic,
    MousePointer,
    Pause,
    Piano,
    Play,
    Printer,
    Redo,
    Repeat,
    ScrollText,
    Search,
    Settings,
    SquarePlay,
    SkipBack,
    Timeline,
    Undo,
    Volume2,
    Waves,
    X,
    ZoomIn,
    ZoomOut,
    createElement
} from 'lucide';
import { icon as renderFontAwesomeIcon, type IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faYoutube } from '@fortawesome/free-brands-svg-icons';
import {
    faFileAudio,
    faFolderOpen,
    faGear,
    faHeadphones,
    faListCheck,
    faMagnifyingGlassMinus,
    faMagnifyingGlassPlus,
    faMapPin,
    faPause,
    faPlay,
    faRedo,
    faTimeline,
    faUndo,
    faVolumeXmark,
    faWaveSquare,
    faXmark
} from '@fortawesome/free-solid-svg-icons';

type IconNode = Parameters<typeof createElement>[0];

export function icon(node: IconNode): SVGElement {
    return createElement(node);
}

export function fontAwesomeIcon(node: IconDefinition): SVGElement {
    return renderFontAwesomeIcon(node).node[0] as SVGElement;
}

export const Icons = {
    Play: Play as IconNode,
    Pause: Pause as IconNode,
    Stop: SkipBack as IconNode,
    Loop: Repeat as IconNode,
    CountIn: Hourglass as IconNode,
    Metronome: Metronome as IconNode,
    Search: Search as IconNode,
    OpenFile: FolderOpen as IconNode,
    Print: Printer as IconNode,
    DownloadGp: Download as IconNode,
    DownloadAudio: FileAudio as IconNode,
    OutputDevice: Headphones as IconNode,
    ChevronDown: ChevronDown as IconNode,
    LayoutHorizontal: ChevronRight as IconNode,
    LayoutPage: ChevronDown as IconNode,
    LayoutParchment: ScrollText as IconNode,
    ScrollOff: MousePointer as IconNode,
    ScrollContinuous: ArrowDownNarrowWide as IconNode,
    ScrollOffScreen: Crop as IconNode,
    ScrollSmooth: BarChart3 as IconNode,
    Volume: Volume2 as IconNode,
    Settings: Settings as IconNode,
    MediaSync: Timeline as IconNode,
    Tracks: ListChecks as IconNode,
    Close: X as IconNode,
    AudioTrack: FileAudio as IconNode,
    YoutubeVideo: SquarePlay as IconNode,
    Synthesizer: Waves as IconNode,
    MapPin: MapPin as IconNode,
    ZoomIn: ZoomIn as IconNode,
    ZoomOut: ZoomOut as IconNode,
    Undo: Undo as IconNode,
    Redo: Redo as IconNode,
    Track: Guitar as IconNode,
    TrackDrum: Drum as IconNode,
    TrackPiano: Piano as IconNode,
    TrackVoice: Mic as IconNode,
    Menu: Menu as IconNode
} satisfies Record<string, IconNode>;

export const FontAwesomeIcons = {
    AudioTrack: faFileAudio,
    Close: faXmark,
    MediaSync: faTimeline,
    Mute: faVolumeXmark,
    OpenFile: faFolderOpen,
    Pause: faPause,
    Play: faPlay,
    Settings: faGear,
    Solo: faHeadphones,
    Synthesizer: faWaveSquare,
    Tracks: faListCheck,
    MapPin: faMapPin,
    ZoomIn: faMagnifyingGlassPlus,
    ZoomOut: faMagnifyingGlassMinus,
    Undo: faUndo,
    Redo: faRedo,
    YoutubeVideo: faYoutube
} satisfies Record<string, IconDefinition>;

export type { IconDefinition, IconNode };
