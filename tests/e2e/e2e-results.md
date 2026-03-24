# Ibid E2E Test Results

Run: 2026-03-24T23:09:48.030Z

## Phase 11: API Access

| Test | Status | Detail |
|------|--------|--------|
| Options page has Grant API button | PASS | Grant API access |
| Options page has API status indicator | PASS |  |
| Welcome page has Grant API button | PASS |  |

## Phase 11: Help

| Test | Status | Detail |
|------|--------|--------|
| Help page has API access section | PASS |  |
| API table lists all sources | PASS |  |
| PDF section not found | WARN |  |
| Privacy section mentions optional API access and rate limiting | PASS |  |

## Phase 11: Timeout

| Test | Status | Detail |
|------|--------|--------|
| Popup shows ready state on restricted page | PASS |  |

## Phase 11: Identifiers

| Test | Status | Detail |
|------|--------|--------|
| IbidIdentifiers loaded | PASS |  |
| extractIdentifier works for DOI | PASS |  |
| extractIdentifier works for arXiv | PASS |  |
| extractDoiFromUrl works for Nature PDF | PASS |  |
| extractIdentifier works for ISBN | PASS |  |
| extractIdentifier works for PMID | PASS |  |

## Phase 11: Firefox

| Test | Status | Detail |
|------|--------|--------|
| Firefox manifest has correct structure | PASS |  |

## Phase 11: ProxyFetch

| Test | Status | Detail |
|------|--------|--------|
| proxyFetch handler works | PASS |  |

## Phase 11: TitleSearch

| Test | Status | Detail |
|------|--------|--------|
| resolveByTitle returns result for GPT-4 | PASS |  |

## Phase 11: ArticleMeta

| Test | Status | Detail |
|------|--------|--------|
| fetchArticleMeta failed (network?) | WARN | Failed to fetch |

## Phase 11: Screenshots

| Test | Status | Detail |
|------|--------|--------|
| Options page with API access section | PASS |  |
| Options API access section focused | PASS |  |
| Welcome/onboarding page full screenshot | PASS |  |
| Onboarding API access section | PASS |  |
| Help page API access section | PASS |  |
| Help page privacy section | PASS |  |


**Total: 22 passed, 0 failed, 2 warnings**
