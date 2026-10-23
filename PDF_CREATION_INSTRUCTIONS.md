# Instructions: Create SLICE_6_PRESENTATION.pdf

## Source File
`candidate/SLICE_6_PRESENTATION.md` contains the complete five-slide presentation content with all corrections applied.

## Corrections Applied

✅ **M07 route corrected** - Changed from "Sales Pipeline / Discovery" to "Deal Next Steps / Evaluation" (verified in `replay.test.ts`)
✅ **Browser testing status** - Reflects project owner's manual testing (not automated/exhaustive)
✅ **Export claims** - Accurately describes implementation status (3 formats, 32/32 tests, manual browser verification)
✅ **AI usage removed** - No undocumented AI tool claims
✅ **Performance claims removed** - No unmeasured comparisons
✅ **ZIP support** - Correctly noted as NOT implemented (future improvement)
✅ **Clickable links** - Live app and GitHub URLs included
✅ **Evidence preserved** - All three findings, transcript citations, metrics verified

## How to Create PDF

### Option 1: Google Slides (Recommended - Free & Easy)

1. **Open Google Slides:**
   - Go to https://slides.google.com
   - Click "Blank presentation"

2. **Create 5 Slides:**
   - Slide 1: Manager Problem & Key Findings
   - Slide 2: Interface Choices & Omissions
   - Slide 3: Routing Design & Difficult Case
   - Slide 4: Transcript Coverage Metric
   - Slide 5: Trade-offs & Limitations

3. **Copy Content:**
   - Open `SLICE_6_PRESENTATION.md`
   - Copy each slide's content into corresponding Google Slide
   - Use clean, readable layout (title + bullets + key points)
   - Keep URLs as clickable hyperlinks

4. **Design Tips:**
   - Use professional theme (suggest: dark background with light text OR white background)
   - Font: Clear sans-serif (Arial, Helvetica, or Google's Roboto)
   - Font sizes: Title 36-44pt, Body 18-24pt
   - Keep slides uncluttered - use white space
   - Highlight key numbers (44 records, 18 transcripts, 40.9% coverage)

5. **Export as PDF:**
   - Click **File** → **Download** → **PDF Document (.pdf)**
   - Save as `SLICE_6_PRESENTATION.pdf`
   - Move to `candidate/` directory

### Option 2: PowerPoint

1. Create new presentation with 5 slides
2. Copy content from `SLICE_6_PRESENTATION.md`
3. Save as → PDF

### Option 3: Markdown to PDF Tools

**Using Pandoc (if installed):**
```bash
cd candidate
pandoc SLICE_6_PRESENTATION.md -o SLICE_6_PRESENTATION.pdf -t beamer
```

**Using Online Converter:**
- https://www.markdowntopdf.com/
- Upload `SLICE_6_PRESENTATION.md`
- Download PDF

### Option 4: VS Code with Markdown PDF Extension

1. Install "Markdown PDF" extension in VS Code
2. Open `SLICE_6_PRESENTATION.md`
3. Right-click → "Markdown PDF: Export (pdf)"

## Verification Checklist

After creating PDF:

- [ ] Exactly 5 slides/pages
- [ ] All URLs are clickable hyperlinks
- [ ] Source citations are legible (M04 Turn 9, M07 Rev 2, M01 Turn 11)
- [ ] Metric numbers clearly visible (44 records, 18 transcripts, 40.9%)
- [ ] File named exactly: `SLICE_6_PRESENTATION.pdf`
- [ ] File saved in: `candidate/` directory
- [ ] File size reasonable (< 5MB)

## Final Steps

1. **Verify PDF opens correctly**
   - Double-click to open
   - Confirm 5 pages render properly
   - Test clickable links

2. **Move to candidate directory:**
   ```bash
   move SLICE_6_PRESENTATION.pdf candidate/
   ```

3. **Commit to Git:**
   ```bash
   cd candidate
   git add SLICE_6_PRESENTATION.pdf
   git commit -m "Add five-slide presentation PDF"
   git push origin main
   ```

## Content Summary

**Slide 1:** Manager problem + 3 findings (M04, M07, M01) with exact citations  
**Slide 2:** Interface choices (evidence-first drawer, on-demand analysis, filterable inbox) + omissions  
**Slide 3:** Routing taxonomy + M07 difficult case (manual route survives update)  
**Slide 4:** Transcript coverage metric (38.6% → 40.9%) + analytical conclusion  
**Slide 5:** On-demand trade-off + limitations + next improvements  

**URLs Included:**
- Live app: https://volopay-1.onrender.com/
- GitHub: https://github.com/Nizath-Mohammed/VOLOPAY

## Troubleshooting

**Problem:** Markdown formatting doesn't convert well  
**Solution:** Use Google Slides and copy content manually for best control

**Problem:** Links not clickable in PDF  
**Solution:** Use hyperlink feature in presentation tool (Insert → Link)

**Problem:** Text too small  
**Solution:** Increase font size to 18-24pt for body text, 36-44pt for titles

**Problem:** Slides too dense  
**Solution:** Break content across multiple bullet points, use white space

---

**Once PDF is created and verified, you'll have completed Slice 6 presentation deliverable!**
