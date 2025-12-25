"use client";

import { makeAutoObservable } from "mobx";

export interface LightboxState {
  open: boolean;
  startIndex: number;
}

class UiStoreImpl {
  lightbox: LightboxState = { open: false, startIndex: 0 };
  projects = {
    open: false as boolean,
    projectId: null as string | null,
    currentIndex: 0 as number,
  };
  pergulaMounted = false as boolean;
  heroFrame = 0 as number;

  constructor() {
    makeAutoObservable(this);
  }

  openLightbox(index: number) {
    this.lightbox.open = true;
    this.lightbox.startIndex = index;
  }

  closeLightbox() {
    this.lightbox.open = false;
  }

  // Projects modal
  openProject(projectId: string, startIndex = 0) {
    this.projects.open = true;
    this.projects.projectId = projectId;
    this.projects.currentIndex = startIndex;
  }
  closeProject() {
    this.projects.open = false;
    this.projects.projectId = null;
    this.projects.currentIndex = 0;
  }
  nextProjectImage(total: number) {
    if (!total) return;
    this.projects.currentIndex = (this.projects.currentIndex + 1) % total;
  }
  prevProjectImage(total: number) {
    if (!total) return;
    this.projects.currentIndex = (this.projects.currentIndex - 1 + total) % total;
  }

  // Pergula mounted
  setPergulaMounted(v: boolean) { this.pergulaMounted = v; }

  // Hero frame
  setHeroFrame(frame: number) { this.heroFrame = frame; }
}

export const uiStore = new UiStoreImpl();


