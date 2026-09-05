import type { TFile } from "obsidian";
import type { ParsedCycle } from "./cycle";

export interface CycleNote {
  file: TFile;
  cycle: ParsedCycle;
  url: string | null;
  image: string | null;
  imageSrc: string | null;
  placeholderIcon: string;
  lastVisitedAt: string | null;
  dueAt: Date | null;
  due: boolean;
}

export interface CyclesSettings {
  mediaFolder: string;
  showCycleDuration: boolean;
  showLastVisited: boolean;
  captureMissingImages: boolean;
  legacyVisitMigrationCompleted: boolean;
}
