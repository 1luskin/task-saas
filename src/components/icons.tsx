/** Icons: lucide-react, Strichstärke 1.8 (design/DESIGN.md). Namen bleiben stabil für alle Aufrufer. */
import {
  Archive, Calendar, ChartColumn, Check, ChevronLeft, ChevronRight, Clock, Camera, Download, Euro, Inbox, ListChecks,
  MapPin, Menu, Play, Plus, Repeat, Settings, Sun, Trash2, User, Users, Wallet, WifiOff, Pin, Search, ClipboardCheck,
  Coffee, Square, Eye, ShieldCheck, Smartphone, Phone, Mail, type LucideIcon,
} from "lucide-react";

type IconProps = { className?: string; "aria-label"?: string };

function mk(Icon: LucideIcon) {
  return function AppIcon({ className = "size-6", ...rest }: IconProps) {
    return <Icon strokeWidth={1.8} className={`shrink-0 ${className}`} aria-hidden={rest["aria-label"] ? undefined : true} {...rest} />;
  };
}

export const IconTasks = mk(ListChecks);
export const IconCalendar = mk(Calendar);
export const IconUsers = mk(Users);
export const IconEuro = mk(Euro);
export const IconRepeat = mk(Repeat);
export const IconChart = mk(ChartColumn);
export const IconSettings = mk(Settings);
export const IconInbox = mk(Inbox);
export const IconArchive = mk(Archive);
export const IconSun = mk(Sun);
export const IconWallet = mk(Wallet);
export const IconUser = mk(User);
export const IconPlus = mk(Plus);
export const IconChevronLeft = mk(ChevronLeft);
export const IconChevronRight = mk(ChevronRight);
export const IconPlay = mk(Play);
export const IconCheck = mk(Check);
export const IconClock = mk(Clock);
export const IconPin = mk(MapPin);
export const IconCamera = mk(Camera);
export const IconDownload = mk(Download);
export const IconMenu = mk(Menu);
export const IconTrash = mk(Trash2);
export const IconWifiOff = mk(WifiOff);
export const IconPinned = mk(Pin);
export const IconSearch = mk(Search);
export const IconChecklist = mk(ClipboardCheck);
export const IconPause = mk(Coffee);
export const IconStop = mk(Square);
export const IconEye = mk(Eye);
export const IconShield = mk(ShieldCheck);
export const IconPhone = mk(Smartphone);
export const IconCall = mk(Phone);
export const IconMail = mk(Mail);
