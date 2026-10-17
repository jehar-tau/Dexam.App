# Printable handbook build

The six Markdown files in `docs/usage` are authoritative. The existing public repository renders them online; the downloadable PDF and DOCX are dated, manually verified editions, not a second editable source of truth. Do not put private data or credentials in either format.

## Regenerate an edition

1. Review all six guides against the implementation and set the edition date in the exporter and handbook home.
2. Use the document runtime's Python with `python-docx` to run `scripts/docs/build-handbook.py` from any directory. No runtime network or database access is used.
3. Use the documents skill renderer with the bundled LibreOffice, not a desktop installation: `render_docx.py docs/usage/downloads/Dexam-application-handbook.docx --output_dir <temporary-qa-directory> --emit_pdf`.
4. Inspect every rendered page for clipping, wrapping, missing text, page breaks and readability. Confirm all role sections and current service limitations remain present. Fix and re-render if needed.
5. Copy the verified PDF from that QA directory to `docs/usage/downloads/Dexam-application-handbook.pdf`. Commit both final downloads and updated Markdown through the normal reviewed PR process. Do not commit intermediate page images.

The exporter converts Markdown tables to labelled records for readable print widths, retains ordered steps, exports external links to canonical repository pages, and skips only the online-only download section and repetitive handbook navigation. The cover lists sections; footer page numbers support printed reference. No new package is installed into the application.
