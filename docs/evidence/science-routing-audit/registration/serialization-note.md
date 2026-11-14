The first rerun reconstructed the same parsed measurement object but stopped at
the raw-byte assertion: the original Windows `Path.write_text` output used CRLF,
while the wrapper serialized UTF-8 with LF. The wrapper now explicitly preserves
the saved line endings. Matching parameters and calculations were unchanged.

The failed command was the exact pinned offline command recorded in the audit.
Exit code: 1; failure: `Recomputed serialized measurements differ from preserved bytes.`
