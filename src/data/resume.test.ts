import { describe, expect, it } from "vitest";
import { getResumeData } from "./resume";

describe("getResumeData", () => {
  it("returns English content for 'en'", () => {
    const data = getResumeData("en");
    expect(data.subtitle).toBe("Senior Software Engineer");
  });

  it("returns Polish content for 'pl'", () => {
    const data = getResumeData("pl");
    // Job titles stay in English by design (standard practice on PL tech
    // CVs) — only the surrounding prose is translated.
    expect(data.summary).not.toBe(getResumeData("en").summary);
    expect(data.jobs[0].achievements?.[0]).not.toBe(
      getResumeData("en").jobs[0].achievements?.[0],
    );
  });

  it("keeps the same shape (job/project counts) across languages", () => {
    const en = getResumeData("en");
    const pl = getResumeData("pl");
    expect(pl.jobs.length).toBe(en.jobs.length);
    expect(pl.personalProjects.length).toBe(en.personalProjects.length);
    expect(pl.sidebar.education.length).toBe(en.sidebar.education.length);
  });

  it("translates prose only — per-entry bullet counts, stacks and links match", () => {
    const en = getResumeData("en");
    const pl = getResumeData("pl");
    en.jobs.forEach((job, i) => {
      const plJob = pl.jobs[i];
      expect(plJob.companyHref).toBe(job.companyHref);
      expect(plJob.stack).toEqual(job.stack);
      expect(plJob.achievements?.length).toBe(job.achievements?.length);
      expect(plJob.projects?.map((p) => p.achievements.length)).toEqual(
        job.projects?.map((p) => p.achievements.length),
      );
    });
    en.personalProjects.forEach((project, i) => {
      expect(pl.personalProjects[i].href).toBe(project.href);
      expect(pl.personalProjects[i].stack).toEqual(project.stack);
      expect(pl.personalProjects[i].achievements.length).toBe(
        project.achievements.length,
      );
    });
    expect(pl.headerLinks.map((l) => l.href)).toEqual(
      en.headerLinks.map((l) => l.href),
    );
  });

  it("lists Resume Agent first in personal projects, in both languages", () => {
    for (const lang of ["en", "pl"] as const) {
      const first = getResumeData(lang).personalProjects[0];
      expect(first.title).toBe("Resume Agent");
      expect(first.href).toBe("https://github.com/niconisoria/resume-agent");
    }
  });
});
