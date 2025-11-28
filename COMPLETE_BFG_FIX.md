# Complete BFG Fix - Step by Step

## Step 1: Download BFG

### Option A: Automatic Download
Run this in PowerShell:
```powershell
.\download-bfg.ps1
```

### Option B: Manual Download
1. Go to: https://rtyley.github.io/bfg-repo-cleaner/
2. Click "Download" 
3. Save `bfg.jar` to `C:\Users\97252\Downloads\bfg.jar`

## Step 2: Use BFG to Remove .env

You already cloned the mirror, so now:

```powershell
# Go to the mirror directory
cd ..\pashkovsky-pergolas-clean.git

# Run BFG (adjust path to where you saved bfg.jar)
java -jar C:\Users\97252\Downloads\bfg.jar --delete-files .env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Push the cleaned history
git push --force

# Go back to your working repo
cd ..\pashkovsky-pergolas_starter
git fetch origin
git reset --hard origin/master
```

## Step 3: Verify

```powershell
git log --all --full-history --oneline -- .env
```
Should return **nothing**.

## Step 4: Push

```powershell
git push --force origin master
```

---

## Alternative: If You Don't Have Java

If you don't have Java installed, use **git-filter-repo** instead:

```powershell
# Install git-filter-repo (requires Python)
pip install git-filter-repo

# Remove .env
git filter-repo --path .env --invert-paths

# Force push
git push --force origin master
```

---

## Quick Check: Do You Have Java?

```powershell
java -version
```

If you see version info, you're good! If not, either:
1. Install Java from https://www.java.com/
2. Or use git-filter-repo (Python) instead

