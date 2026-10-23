# Public portfolio visitor review

Checked on October 23, 2026.

## Changes

- Featured JobRelay on the homepage with a capture of its actual dashboard UI.
  The preview uses deterministic sample responses and is labelled as sample data;
  it does not imply that an unauthenticated JobRelay service is publicly hosted.
- Added a keyboard-accessible PDF chooser, a skip link, heading focus after
  navigation, and page-specific browser titles.
- Fixed project-page overflow at phone width and content left invisible when
  reduced-motion preferences disable entrance animations.
- Separated the public feeds' failure states, added retry, and bounded stalled
  feed requests to ten seconds. Failed public LeetCode profile requests show an
  unavailable message and a source link rather than a false zero solved count.

## Verification

- 51 unit tests passed, including upload keyboard handling, profile failure,
  malformed feed responses, and the feed-request timeout.
- All 12 public routes rendered at 390, 1100, and 1440 pixels without horizontal
  page overflow. Reduced-motion navigation remained visible.
- Keyboard menu navigation moved focus to the selected page heading; the skip
  link reached the main content. The downloaded resume contained real PDF bytes.
- Ascend's sample selection, import, and reset worked. Invalid PDF feedback and
  the scoring result UI worked; scoring was intercepted locally, without a paid
  AI call or tracker write.
- Loading, one-feed failure, recovery by retry, empty activity, and profile-failure
  states passed in controlled browser checks. The theme and email link worked.
- All 19 collected GitHub source/repository links were anonymously accessible.
  File destinations were checked through their equivalent raw branch/file URLs.
- The deployed homepage, resume download, activity feed page and LeetCode page
  loaded anonymously without page JavaScript errors during the live check.

## Repeat the browser checks

Build with local public Cognito configuration, then start a production preview
on port 5185. The journey test intercepts the feed and scoring endpoints, so it
does not require real tracker data or scoring credentials.

With Playwright available to Node (or `PLAYWRIGHT_MODULE` set to its installed
module path), run:

```text
node scripts/check-portfolio-journey.cjs
node scripts/check-portfolio-public-links.cjs
```

`PORTFOLIO_BASE_URL` overrides the local preview origin. `PORTFOLIO_REVIEW_DIR`
overrides the output directory, which defaults to `.portfolio-review`.

To regenerate JobRelay's image, set `JOBRELAY_PUBLIC_DIR` to the JobRelay repo's
`public` directory and run `node scripts/capture-jobrelay-preview.cjs`.

The review does not cover authenticated tracker mutations or the paid scoring
service end to end. Email and LinkedIn destinations were inspected without
sending a message or signing into an external account.
