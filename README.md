# Spheres of Power Wiki Archive

This repository is a dedicated initiative to both preserve and modernize the incredible legacy of the *Spheres of Power* ruleset and its surrounding ecosystem.

At its core, this project exists to ensure that the monumental effort put forth by the original creators, contributors, and maintainers is never lost to time. We are building a robust, automated pipeline to archive the definitive rules text directly from the Wikidot platform.

## Acknowledgment & Gratitude

This project is built upon the shoulders of giants. We want to extend our deepest gratitude and respect to **Rednal** and the countless authors, editors, and community members who have poured thousands of hours into maintaining the official Spheres of Power wiki archive over the years. 

Your dedication transformed a mechanical subsystem into one of the most beloved, expansive, and well-supported third-party rulesets in tabletop history. This archive is a love letter to that effort—aiming to secure your work for future generations of players while respecting the passion that brought it to life.

## Repository Structure

- **`pages/`**: Contains the raw text content of every page from the Spheres of Power Wikidot.
- **`.github/workflows/`**: Contains the automated GitHub Actions workflow that runs a daily incremental sync.

## Automation

This repository is automatically maintained by an external crawler (`wdotcrawl`). Every day, a GitHub Action queries the wiki's sitemap and incrementally fetches and commits any new revisions directly to the `pages/` directory. This guarantees that any new errata, updates, or community changes are immediately preserved.

---

*Thank you to everyone who has ever rolled a die using these rules, written a page for the wiki, or supported third-party tabletop development.*
