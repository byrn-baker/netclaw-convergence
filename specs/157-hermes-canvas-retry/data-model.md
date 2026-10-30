# Data Model

Hermes task adds optional `hermesSeed: [{role,content}]`, cloned at task creation only. Empty[] differs from absent (legacy/unseeded). Existing IDs, nonce requests and ownership remain unchanged. Max200messages/1MiB UTF-8. Binding save max8MiB matches readBounded; all failures precede replacement. Seed survives ordinary restart and expires with binding.
