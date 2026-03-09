# Test Plan for App Shell Layout (BIN-56)

## Overview
This document outlines the manual test plan for the foundational app shell layout implementation. Since no test framework is currently configured, all tests should be performed manually.

## Manual Test Checklist

### 1. Component Rendering Tests

#### Navigation Component
- [ ] Navigation renders without errors
- [ ] All navigation links are present (Home, Stories, Settings)
- [ ] App logo/identity is visible at the top
- [ ] Active route is highlighted correctly
- [ ] `aria-current="page"` is set on the active link

#### Header Component
- [ ] Header renders with correct page title
- [ ] Page title updates based on current route
- [ ] Mobile menu button appears only on mobile viewports
- [ ] Action slot is present (empty for now)

#### ContentContainer Component
- [ ] Main content area renders children correctly
- [ ] Semantic `<main>` landmark is used
- [ ] Max-width constraint is applied (1200px)
- [ ] Content is centered on wide screens

#### AppShell Component
- [ ] AppShell composes Navigation, Header, and ContentContainer correctly
- [ ] Skip-to-main-content link is present and functional
- [ ] Mobile nav drawer state toggles correctly
- [ ] Page title updates when navigating between routes

### 2. Route-Level Tests

#### Home Page (/)
- [ ] Page renders with AppShell wrapper
- [ ] "Welcome back" section is visible
- [ ] "Recent Stories" card is present with empty state
- [ ] "Quick Resume" card is present with empty state
- [ ] No hex colors visible (all using design tokens)

#### Stories Page (/stories)
- [ ] Page renders with AppShell wrapper
- [ ] Search input is functional and accessible
- [ ] Filter/Sort placeholder is visible
- [ ] Empty state message displays correctly

#### Story Detail Page (/story/[id])
- [ ] Page renders with AppShell wrapper
- [ ] Title input is editable
- [ ] Editor textarea is present and functional
- [ ] Sidebar displays on desktop (>1023px)
- [ ] Sidebar hides on mobile/tablet (<1024px)
- [ ] Notes placeholder is visible in sidebar

#### Settings Page (/settings)
- [ ] Page renders with AppShell wrapper
- [ ] All three setting groups render (Account, Preferences, Appearance)
- [ ] Placeholder content is visible in each group

### 3. Accessibility Tests

#### Keyboard Navigation
- [ ] Tab order: Skip link → Navigation links → Header actions → Main content
- [ ] All interactive elements are keyboard accessible
- [ ] Enter key activates navigation links
- [ ] Focus moves logically through the page

#### Focus Visibility
- [ ] All interactive elements show visible focus ring (2px outline)
- [ ] Focus ring has adequate contrast (visible against backgrounds)
- [ ] Focus states are consistent across components

#### Semantic HTML
- [ ] `<nav>` landmark is present for navigation
- [ ] `<header>` landmark is present in Header component
- [ ] `<main>` landmark is present in ContentContainer
- [ ] Headings follow logical hierarchy (h1, h2, h3)

#### ARIA Attributes
- [ ] Navigation has `aria-label="Main navigation"`
- [ ] Active route link has `aria-current="page"`
- [ ] Search input has proper `aria-label`
- [ ] Editor textareas have proper `aria-label`
- [ ] Section headings are properly associated with `aria-labelledby`

#### Color Contrast
- [ ] Primary text (black-700) meets WCAG AA against white background
- [ ] Secondary text (elephant-500) meets WCAG AA
- [ ] Tertiary text (cement-400) meets WCAG AA
- [ ] Focus ring (carbon-600) is clearly visible

### 4. Responsive Behavior Tests

#### Desktop (≥1024px)
- [ ] Navigation sidebar is persistent (240px width)
- [ ] Header is fixed at top (64px height)
- [ ] Content area has max-width constraint (1200px)
- [ ] Story editor sidebar is visible (300px width)

#### Tablet (768px - 1023px)
- [ ] Navigation sidebar is narrower (200px width)
- [ ] All content remains accessible
- [ ] Story editor sidebar is hidden
- [ ] Touch targets are adequate (≥44px)

#### Mobile (<768px)
- [ ] Navigation is hidden by default
- [ ] Menu button appears in header
- [ ] Clicking menu button opens nav drawer
- [ ] Nav drawer overlay darkens background
- [ ] Clicking overlay closes nav drawer
- [ ] Content flows naturally at narrow width
- [ ] No horizontal scrolling occurs

### 5. Design Token Validation

#### Color Token Usage
- [ ] No hex colors outside `src/styles/tokens.css`
- [ ] All text uses approved grayscale tokens
- [ ] All backgrounds use approved grayscale tokens
- [ ] All borders use `--color-fashion-300` or approved token

Search for hex colors:
```bash
grep -r "#[0-9a-fA-F]\{3,6\}" src/app src/components --exclude-dir=node_modules | grep -v tokens.css
```

Expected result: No matches (all colors in tokens.css only)

### 6. Build and Lint Validation

#### TypeScript Compilation
```bash
npm run build
```
- [ ] Build completes with zero errors
- [ ] No TypeScript type errors
- [ ] All imports resolve correctly

#### Development Server
```bash
npm run dev
```
- [ ] Dev server starts without errors
- [ ] No console errors in terminal
- [ ] Hot reload works when editing files

### 7. Visual Review Checklist

#### Cross-Browser Testing (if applicable)
- [ ] Chrome: All features work correctly
- [ ] Firefox: All features work correctly
- [ ] Safari: All features work correctly
- [ ] Edge: All features work correctly

#### Layout Stability
- [ ] No layout shift on page load
- [ ] No layout shift when navigating between routes
- [ ] No layout shift when resizing window

#### Animation and Transitions
- [ ] Mobile nav drawer slides in smoothly
- [ ] Link hover states transition smoothly
- [ ] Focus states appear without delay
- [ ] No jarring visual changes

## Testing Procedure

1. **Start the dev server**: `npm run dev`
2. **Navigate through all routes**: /, /stories, /story/123, /settings
3. **Test keyboard navigation**: Use only Tab, Shift+Tab, and Enter
4. **Test responsive breakpoints**: Resize browser to 1440px, 768px, 375px
5. **Test mobile nav**: Click menu button, verify drawer opens/closes
6. **Verify design tokens**: Search for hex colors outside tokens.css
7. **Run build**: `npm run build` and verify success

## Known Limitations

- No automated tests (requires test framework setup in future ticket)
- Manual testing only (time-consuming, prone to human error)
- No visual regression testing
- No performance testing

## Future Test Framework Recommendations

Consider adding in future tickets:
- Jest + React Testing Library for component unit tests
- Playwright or Cypress for E2E tests
- Axe or Pa11y for automated accessibility testing
- Percy or Chromatic for visual regression testing
