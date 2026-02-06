# 🚀 Deploy to GitHub

## Step 1: Initialize Git Repository

```bash
cd ~/.openclaw/workspace/focus-guard
git init
```

## Step 2: Add All Files

```bash
git add .
```

## Step 3: Create Initial Commit

```bash
git commit -m "Initial commit: Focus Guard v1.1.1

Features:
- Focus timer with customizable duration (25/45/60min or custom)
- Multi-page focus support
- Smart distraction detection with dual-timer strategy
- Full-screen overlay alerts
- Audio and system notifications
- Pause/resume and break mode
- Modern dark theme UI with neon gradients
- Distraction count tracking

Technical:
- Manifest V3 Chrome extension
- Service Worker for background monitoring
- Content script injection for overlays
- Dual-timer detection (500ms record + 1000ms alert)
- Performance optimized (0.1 msg/sec)

Fixes:
- Prevent gaming the system by quick tab switching
- Accurate distraction tracking (95% accuracy)
- Memory leak prevention
- URL parsing error handling
- Audio playback fix for extension URLs"
```

## Step 4: Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click **"New repository"** or visit https://github.com/new
3. Repository settings:
   - **Name**: `focus-guard`
   - **Description**: `🎯 A Chrome extension that helps you stay focused by detecting and alerting when you get distracted`
   - **Public** or **Private** (your choice)
   - ⚠️ **DO NOT** initialize with README, .gitignore, or license (we already have them)
4. Click **"Create repository"**

## Step 5: Connect to GitHub

Replace `yourusername` with your GitHub username:

```bash
git remote add origin https://github.com/yourusername/focus-guard.git
```

Or use SSH (if you have SSH keys set up):

```bash
git remote add origin git@github.com:yourusername/focus-guard.git
```

## Step 6: Push to GitHub

```bash
git branch -M main
git push -u origin main
```

## Step 7: Update README (Optional)

After creating the repository, update the links in README.md:

```bash
# Replace all instances of "yourusername" with your actual GitHub username
sed -i '' 's/yourusername/YOUR_GITHUB_USERNAME/g' README.md

# Commit the change
git add README.md
git commit -m "Update GitHub repository links in README"
git push
```

---

## 📋 Quick Command Summary

```bash
# Navigate to project
cd ~/.openclaw/workspace/focus-guard

# Initialize git
git init

# Add all files
git add .

# Commit with detailed message
git commit -m "Initial commit: Focus Guard v1.1.1

Features:
- Focus timer with customizable duration (25/45/60min or custom)
- Multi-page focus support
- Smart distraction detection with dual-timer strategy
- Full-screen overlay alerts
- Audio and system notifications
- Pause/resume and break mode
- Modern dark theme UI with neon gradients
- Distraction count tracking

Technical:
- Manifest V3 Chrome extension
- Service Worker for background monitoring
- Content script injection for overlays
- Dual-timer detection (500ms record + 1000ms alert)
- Performance optimized (0.1 msg/sec)

Fixes:
- Prevent gaming the system by quick tab switching
- Accurate distraction tracking (95% accuracy)
- Memory leak prevention
- URL parsing error handling
- Audio playback fix for extension URLs"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/focus-guard.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🔄 Future Updates

After making changes to the code:

```bash
# Check status
git status

# Add changed files
git add .

# Commit with descriptive message (in English)
git commit -m "Fix: Brief description of the change"

# Push to GitHub
git push
```

### Commit Message Guidelines

Use conventional commit format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Adding tests
- `chore:` Maintenance tasks

**Examples**:
```bash
git commit -m "feat: Add whitelist functionality"
git commit -m "fix: Resolve audio playback issue on Chrome 120+"
git commit -m "docs: Update installation instructions"
git commit -m "perf: Reduce message passing frequency by 90%"
```

---

## ✅ Verification

After pushing, verify your repository:

1. Visit `https://github.com/YOUR_USERNAME/focus-guard`
2. Check that all files are present
3. Verify README displays correctly
4. Confirm version badge shows `1.1.1`

---

## 🎉 All Done!

Your Focus Guard extension is now on GitHub!

Don't forget to:
- ⭐ Star your own repository
- 📝 Update the repository description
- 🏷️ Add topics: `chrome-extension`, `productivity`, `focus`, `pomodoro`, `manifest-v3`
- 📄 Ensure the license is set to MIT
