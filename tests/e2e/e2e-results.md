# Ibid E2E Test Results

Run: 2026-03-23T09:24:49.017Z

## Phase 1: Setup

| Test | Status | Detail |
|------|--------|--------|
| Extension ID valid | PASS | nkifkdflchiacdjobndjogdajpcecfhf |
| Popup opens | PASS | Title: "Ibid" |
| No console errors | PASS |  |
| WASM engine ready | PASS |  |
| Engine version | PASS | {"version":"0.1.0","wasmReady":true,"wasmError":null} |
| Service worker running | PASS |  |
| Bundled styles count | PASS | 67 styles |
| Style "apa" bundled | PASS |  |
| Style "modern-language-association" bundled | PASS |  |
| Style "chicago-author-date" bundled | PASS |  |
| Style "ieee" bundled | PASS |  |
| Style "vancouver" bundled | PASS |  |
| Style "harvard-cite-them-right" bundled | PASS |  |

## Phase 2: Extraction

| Test | Status | Detail |
|------|--------|--------|
| Title extracted | PASS | Single-molecule states link transcription factor binding to  |
| Authors extracted | PASS | Doughty, Benjamin R.; Hinks, Michaela M.; Schaepe, Julia M.;... |
| DOI extracted | PASS | 10.1038/s41586-024-08219-w |
| Date extracted | PASS | 2024-11-20 |
| Journal extracted | PASS | Nature |
| Source type | PASS | article-journal |
| Bib preview rendered | PASS | Doughty, B. R., Hinks, M. M., Schaepe, J. M., Marinov, G. K., Thurm, A. R., Rios |
| In-text preview rendered | PASS | (Doughty et al., 2024) |
| No console errors | PASS |  |

## Phase 3: Styles

| Test | Status | Detail |
|------|--------|--------|
| Style picker opens | PASS |  |
| Style items listed | PASS | 72 styles |
| Style search filters | PASS | 5 results for "vancouver" |
| Initial bib (APA) | PASS | Doughty, B. R., Hinks, M. M., Schaepe, J. M., Marinov, G. K., Thurm, A. R., Rios |
| IEEE format: initials-first | PASS | B. R. Doughty, M. M. Hinks, J. M. Schaepe, G. K. Marinov, A. R. Thurm, C. Rios-M |
| MLA format | PASS | Doughty, Benjamin R., et al. “Single-Molecule States Link Transcription Factor B |
| MLA et al. in bib | PASS |  |
| MLA quoted title | PASS |  |
| No ANSI codes in MLA | PASS |  |

## Phase 3: P/N

| Test | Status | Detail |
|------|--------|--------|
| Initial P in-text | PASS | (Doughty et al.) |
| P has parentheses | PASS |  |
| N in-text | PASS | Doughty et al. |
| N is narrative (no leading paren) | PASS |  |
| N has et al. (12 authors) | PASS |  |
| P restored after N→P | PASS | (Doughty et al.) |
| P has et al. after toggle | PASS |  |

## Phase 3: Library

| Test | Status | Detail |
|------|--------|--------|
| Citation added to library | PASS | 1 total |
| Entry has title | PASS | Single-molecule states link transcription factor b |
| Entry has authors | PASS | 12 authors |
| Entry has DOI | PASS | 10.1038/s41586-024-08219-w |
| Entry has _projectIds | PASS | ["default"] |

## Phase 3: Sidepanel

| Test | Status | Detail |
|------|--------|--------|
| Library shows entries | PASS | 1 rows |
| Tab "library" visible | PASS |  |
| Tab "import" visible | PASS |  |
| Tab "export" visible | PASS |  |
| Settings gear visible | PASS |  |
| Manual entry button visible | PASS |  |
| No gibberish in sidepanel | PASS |  |
| No console errors | PASS |  |

## Phase 3: Inline Preview

| Test | Status | Detail |
|------|--------|--------|
| Preview opens on click | PASS |  |
| Bib output rendered | PASS | Doughty, B. R., Hinks, M. M., Schaepe, J. M., Marinov, G. K., Thurm, A. R., Rios |
| In-text output rendered | PASS | (Doughty et al., 2024) |
| P/N toggle buttons | PASS | 2 buttons |
| Copy in-text button visible | PASS |  |
| Style picker visible | PASS |  |
| Bib/in-text separator | PASS |  |
| No ANSI gibberish | PASS |  |

## Phase 4: Import

| Test | Status | Detail |
|------|--------|--------|
| BibTeX pasted | PASS |  |
| Preview list visible | PASS |  |
| Parsed 2 entries | PASS |  |
| Preview count | PASS | 2 |
| Import status | PASS | Parsed 2 entries |
| Project selector visible | PASS |  |
| Default project | PASS | default |
| Entries imported | PASS | 2 new (1 → 3) |
| Library rows after import | PASS | 3 rows |
| Ross article in library | PASS |  |
| Knuth book in library | PASS |  |
| Ross has _projectIds | PASS | ["default"] |
| Ross has _importSource | PASS | import |
| Duplicate detection blocked re-import | PASS |  |
| Duplicate status message | PASS | All 2 entries are duplicates. Nothing imported. |

## Phase 4: Manual Entry

| Test | Status | Detail |
|------|--------|--------|
| Form opens | PASS |  |
| Form closes after save | PASS |  |
| Entry appears in library | PASS |  |
| Cancel hides form | PASS |  |

## Phase 5: Export

| Test | Status | Detail |
|------|--------|--------|
| Format dropdown visible | PASS |  |
| Project filter visible | PASS |  |
| Has "All Projects" option | PASS |  |
| Has "My Bibliography" option | PASS |  |
| Scope filter visible | PASS |  |
| Export count shown | PASS | 4 citations will be exported |
| Download button | PASS |  |
| Copy button | PASS |  |
| BibTeX copy success | PASS | Copied to clipboard! |
| RIS copy | PASS | Copied to clipboard! |
| All entries count | PASS | 4 citations will be exported |
| Starred filter count | PASS | 0 citations will be exported |
| Starred <= All | PASS | 0 <= 4 |
| Journals filter count | PASS | 3 citations will be exported |
| CSL-JSON copy | PASS | Copied to clipboard! |

## Phase 5: Library

| Test | Status | Detail |
|------|--------|--------|
| Visit source links present | PASS | 2 links |
| Source link has valid URL | PASS | https://doi.org/10.1128/mr.59.3.423-450.1995 |

## Phase 5: Settings

| Test | Status | Detail |
|------|--------|--------|
| Settings dropdown opens | PASS |  |
| Sort dropdown | PASS |  |
| Copy format dropdown | PASS |  |
| Theme dropdown | PASS |  |
| Advanced Settings link | PASS |  |
| Dark theme applied | PASS |  |
| Dropdown closes on outside click | PASS |  |

## Phase 6: Enhance

| Test | Status | Detail |
|------|--------|--------|
| DOI fills title | PASS | The Sequence of the Human Genome |
| DOI fills authors | PASS |  |
| DOI fills date | PASS |  |
| DOI fills journal | PASS |  |
| Preview renders | PASS | Venter, J. Craig, et al. “The Sequence of the Human Genome.” Science, vol. 291,  |
| ISBN fills title | FAIL |  |
| Invalid ID handled | PASS | no title filled |

## Phase 6: Download

| Test | Status | Detail |
|------|--------|--------|
| Remote results | PASS |  |
| Style downloaded | PASS | Public Library of Science |

## Phase 7: Edge

| Test | Status | Detail |
|------|--------|--------|
| Popup loads | PASS |  |
| No critical errors | PASS |  |
| Empty add prevented | PASS | feedback=true, citations=4 |
| No XSS | PASS |  |
| n.d. shown | WARN | (Test) |

## Phase 8

| Test | Status | Detail |
|------|--------|--------|
| Star → saffron | PASS |  |
| Unstar | PASS |  |
| Search filters | PASS | 1/4 |
| No match → 0 | PASS |  |
| Clear restores | PASS |  |
| Sort: title-asc | PASS |  |
| Sort: author-asc | PASS |  |
| Sort: year-desc | PASS |  |
| Sort: date-desc | PASS |  |
| Chip "article-journal" | PASS | 3/4 |
| Chip "book" | PASS | 1/4 |
| Bulk bar visible | PASS |  |
| Bulk bar hides | PASS |  |
| All Projects | PASS |  |
| My Bibliography | PASS |  |
| Delete confirm dialog | PASS |  |
| Delete | PASS | 5→4 |

## Phase 8: Gibberish

| Test | Status | Detail |
|------|--------|--------|
| Body clean | PASS |  |
| Preview 0 | PASS |  |
| Preview 1 | PASS |  |
| Preview 2 | PASS |  |

## Phase 9: Projects

| Test | Status | Detail |
|------|--------|--------|
| New project input appears | PASS |  |
| Input has maxlength | PASS | 50 |
| Project created and selected | PASS | Test Project E2E |
| Actions button visible | PASS |  |
| Actions menu opens | PASS |  |
| Rename saved | WARN | Test Project E2E |
| Delete confirm dialog | PASS |  |
| Dialog mentions project | PASS |  |
| Reverts to All after delete | PASS | all |
| Actions hidden after delete | PASS |  |
| Duplicate name rejected | PASS | all |

## Phase 9: Validation

| Test | Status | Detail |
|------|--------|--------|
| #field-title maxlength=500 | PASS | got 500 |
| #field-authors maxlength=2000 | PASS | got 2000 |
| #field-date maxlength=10 | PASS | got 10 |
| #field-doi maxlength=200 | PASS | got 200 |
| #field-publisher maxlength=200 | PASS | got 200 |
| #field-container maxlength=300 | PASS | got 300 |
| #field-volume maxlength=20 | PASS | got 20 |
| #field-issue maxlength=20 | PASS | got 20 |
| #field-pages maxlength=30 | PASS | got 30 |
| #field-tags maxlength=500 | PASS | got 500 |
| Date has pattern | PASS | \d{4}(-\d{1,2}){0,2} |
| #manual-title maxlength=500 | PASS | got 500 |
| #manual-authors maxlength=2000 | PASS | got 2000 |
| #manual-year maxlength=4 | PASS | got 4 |
| #manual-doi maxlength=200 | PASS | got 200 |
| #manual-volume maxlength=20 | PASS | got 20 |
| #manual-issue maxlength=20 | PASS | got 20 |
| #manual-pages maxlength=30 | PASS | got 30 |
| #manual-publisher maxlength=200 | PASS | got 200 |
| #manual-container maxlength=300 | PASS | got 300 |
| Import textarea maxlength | PASS | 512000 |
| Search maxlength | PASS | 100 |

## Phase 9: UI

| Test | Status | Detail |
|------|--------|--------|
| Manual + button highlights on open | PASS |  |
| Manual + button unhighlights on cancel | PASS |  |
| Tags input hidden initially | PASS |  |
| Tags input visible after click | PASS |  |
| Tag button highlighted | PASS |  |
| Tags input hidden after toggle | PASS |  |

## Phase 9: Search

| Test | Status | Detail |
|------|--------|--------|
| Search finds by tag | PASS | 1 results |

## Phase 9B

| Test | Status | Detail |
|------|--------|--------|
| Delete shows confirm dialog | PASS |  |
| Dialog mentions title | PASS | 
      
        Delete Citation
        Delete "Single-molecule states link tran |
| Cancel preserves entry | PASS |  |
| Edit panel opens | PASS |  |
| Project selector in edit | PASS |  |
| Has My Bibliography | PASS |  |
| Cancel button in edit | PASS |  |
| Edit panel closes on cancel | PASS |  |
| Save shows success | PASS | Saved! |
| DOI paste import | PASS | 2 entries |
| Preview has DOI links | PASS |  |
| Cancel clears import | PASS |  |
| Book type available | PASS |  |
| No CSP violations in popup | PASS |  |
| Bulk import banner shown | PASS |  |
| Banner has count | PASS | 
      
      1 DOI(s) ready to import.
      Open Library
     |
| Open Library button | PASS |  |

## Phase 10: Screenshots

| Test | Status | Detail |
|------|--------|--------|
| Popup APA (1280x800) | PASS |  |
| Popup APA (640x400) | PASS |  |
| Style picker open | PASS |  |
| MLA formatting | PASS |  |
| Library sidepanel | PASS |  |
| Import BibTeX | PASS |  |
| Small promo (440x280) | PASS |  |
| Marquee promo (1400x560) | PASS |  |
| Help page | PASS |  |
| Help library section | PASS |  |
| Help styles section | PASS |  |

## Phase 10: Help

| Test | Status | Detail |
|------|--------|--------|
| Popup citation | PASS |  |
| Style picker | PASS |  |
| P/N toggle | PASS |  |
| Tags input | PASS |  |
| Library list | PASS |  |
| Inline preview | PASS |  |
| Preview detail | PASS |  |
| Manual entry form | PASS |  |
| Settings dropdown | PASS |  |
| Import tab | PASS |  |
| Export tab | PASS |  |


**Total: 213 passed, 1 failed, 2 warnings**
