# Minimal Street frozen source baseline

Captured: 2026-10-05 04:47:03 UTC
Branch: ltms-desktop-ux
HEAD: dcaac62b052b1e5d246e3bac516bc40f455f7257
Scope: frontend/src/api/, frontend/src/types/, frontend/src/hooks/, frontend/src/shared/store.ts, frontend/src/shared/rules.ts.
Purpose: compare the frontend API, DTO, hook, store, and rule working tree after the rollout against this captured starting state.
This manifest includes working-tree files, including inherited uncommitted changes; it does not use HEAD as the sole baseline.

| SHA-256 | Path |
| --- | --- |
| `fed23fdc88b23276ddaf74464d6f29ad85dccad3394b05574868b96588280bef` | `frontend/src/api/admin.contract.test.ts` |
| `db4369faae40604bfc732b07695ed87f8e951fd4369872ba1b64dceab17527d7` | `frontend/src/api/admin.test.ts` |
| `47e20a5e9eac57e5dd358ff29516d6deb2a492d703c43500ccce688ce8bef423` | `frontend/src/api/admin.ts` |
| `39c382b239441de5832e7d43de6510e1a246a5b9267a6d84d36dbe7e1def8901` | `frontend/src/api/auth.ts` |
| `2eda72dd9440c12122fe82ebcd484a20e912d7290a7b240cd497bd3b92e13134` | `frontend/src/api/client.test.ts` |
| `f218fd996067fa89f230c5404fe5f1a1e9eb318c90e66ca0b84268899dcbfa76` | `frontend/src/api/client.ts` |
| `cfc012112598989630ba99a6cb7012ee98d07773dc3c07d9525d981e2b5023c1` | `frontend/src/api/engagement.contract.test.ts` |
| `809f48d3bc131211cfd940dc5c76aac877d7d901b462022d8e5a07245a7abeb7` | `frontend/src/api/engagement.ts` |
| `26cd5353782b0467db7377a5c0a46d569e2504b99bf8d6e368706ac945d572ac` | `frontend/src/api/ids.ts` |
| `5cb6c2ca59d87c0176c2dc0db84d3d685c89c60cf5b19b26e006845034574443` | `frontend/src/api/liveEngagement.test.ts` |
| `7a691e40e3d3a61ed219cdc7648a3a21d76de3ac0b615fbecb867593150f3aa2` | `frontend/src/api/liveEngagement.ts` |
| `faa75b2aee50dfb5ecfacbe9f0769e1fa63bd9078836da1ddcc6e98af215dbe0` | `frontend/src/api/match.test.ts` |
| `deba4945afb104450eb24e74424990fa045013bc5608cd2699506fd788fbe609` | `frontend/src/api/match.ts` |
| `a813febe3e68905241e072034d9485f33f7006a9c79d43f915e655946d410316` | `frontend/src/api/matchWorkflow.test.ts` |
| `32c048dfd2843194acde8554a23e936c03c6ac086f206139947878e94812bb15` | `frontend/src/api/matchWorkflow.ts` |
| `bd6dccf1fca1c020d7bebbe73342ed859baec4e36ae76a350a5b4c27888f45dc` | `frontend/src/api/notification.test.ts` |
| `863a46718cc28122ce1dce86822556b75941729982f0228d503b845c9d23ffa0` | `frontend/src/api/notification.ts` |
| `8b6d7ad2a2674cd8992028bad94974df0068e91a09644295195c928810e14775` | `frontend/src/api/reference.ts` |
| `320a828233dc68f504fb696d5e69118c0cb9410783fa60118bb9d64615017479` | `frontend/src/api/team.test.ts` |
| `40df0bb31557998ad37b05a97d69def520946962a94e4ba6b2544a4b55edfe15` | `frontend/src/api/team.ts` |
| `27c6d4517e5c4c735fe4b7d6e48e46e4cdf2bd3579b728215f7c497d58f43a60` | `frontend/src/api/tournament.test.ts` |
| `024dc8ca6f4dc407281553030a74972a094b5a56653417f7f2b9043a860a69ef` | `frontend/src/api/tournament.ts` |
| `305ef83244001a0e9fca024310d1e81e3ed1fd62c322c91f93fbe5398cc68440` | `frontend/src/api/upload.test.ts` |
| `1f9aa6c78d97782e5f27ddb05f3786d52e59f35a99b1479d0c3fe192b336e1b1` | `frontend/src/api/upload.ts` |
| `4e8a69dc277b9a0e928da4fedf8dc32e716ef8e0091f0335d212cecd4ab172ef` | `frontend/src/api/user.ts` |
| `0574f5df103b5f671200164a4d2726c1c55eaa3aaead390cd4a37fd683d8eb31` | `frontend/src/hooks/useAdmin.ts` |
| `7c5acecc309b0d6f4efeaa1e0b182118b915d65359db2e24495ee6dc7a13c3c0` | `frontend/src/hooks/useAuth.ts` |
| `25fbc0b3f65c20a71d83e2bbd16f15f80f17e954867ac08c1e8cbcf86b040351` | `frontend/src/hooks/useLiveEngagement.test.tsx` |
| `c42a9b7c12eea0cc29a16c5c799a700838ad539708fe163ee3f84be391c0f6c4` | `frontend/src/hooks/useLiveEngagement.ts` |
| `2850da1eacc8964e7f3d33a4b23eb85fe2e10da4465665e1953653757a7b0b2c` | `frontend/src/hooks/useMatch.ts` |
| `d9e1abb93f0e0ab2ae7b2e422214ac0396638c529c34a548ddacf60579c07b32` | `frontend/src/hooks/useMatchWorkflow.ts` |
| `792a9778d37da56ab948d94434597a5179a88268869c9324daed35a98a6453fc` | `frontend/src/hooks/useNotifications.ts` |
| `faa9112894d4d2fbd1f4fe8a2845084ff1da93b716132a4ad1ceb94dc57989b8` | `frontend/src/hooks/useNow.ts` |
| `ff34c839100ae5ceb174d4221afb570b686f2fad16a2aa285de5ea2f4be4c646` | `frontend/src/hooks/useReference.ts` |
| `92d63b252e64aeeb0d59310e39f85b9a16e4aa0c488defd782f51bbdcd7c7c1c` | `frontend/src/hooks/useTeam.ts` |
| `b87b448208c1c4dcecb9092bdacc881437927331d776eff6e77f22e43cf9c717` | `frontend/src/hooks/useTournament.ts` |
| `93db0bd0bd574d7c4fa91a8539ac51bdb4d7ba3ef141ec6b3ed57ec8b0ad201e` | `frontend/src/hooks/useUser.ts` |
| `e4ba8ed581f3c58e6a69dbb083f1151a5ff76ba75ae3cc703bb9a27424db2ef1` | `frontend/src/shared/rules.ts` |
| `ced7c70c812f4f84b83d24088f7ce213069e0680463102bb579697d2af880717` | `frontend/src/shared/store.ts` |
| `52ee46c857f0aa49842f69b7f5b3ef5facfda02c8206731c42872d743661edcc` | `frontend/src/types/admin.dto.ts` |
| `00fcd465eed84684caebb73182380134d5298b22b58721faa54d1f2873d1cd0d` | `frontend/src/types/dto.ts` |
| `3802a0a728c2303ee87fc14881659ed131cc17590eba01fc978c0b58679b158b` | `frontend/src/types/engagement.dto.ts` |
| `b685c29c772885387f0e259fe6c5af6872329b89bc78c48d20e02d94dc0a1950` | `frontend/src/types/enums.ts` |
| `5f7bc1fe1887a5a21abf7a899fc01acf8d873a3a8cb66a06fc5bede13d05d38e` | `frontend/src/types/liveEngagement.dto.ts` |
| `9d4d330dee678aa42f2db417ccbe2c56b025119c8c26681f9136184ddaf65707` | `frontend/src/types/match.dto.ts` |
| `418d59c96722b128f374c505b2bd07a3344666cd299e2f2465facef44fede928` | `frontend/src/types/matchWorkflow.dto.ts` |
| `f974006ed79c597adcc37368ff32b0b9cbaf6dd80ef3365d92f83874dc863069` | `frontend/src/types/notification.dto.ts` |
| `3ddf720ab603a657d3afc07212897c98419e40b242bb5acfb5a3d60c4384c63a` | `frontend/src/types/team.dto.ts` |
| `9549a1453e604b42b69b51490419653e12466205a11ff79ed53b2bfba55c08fa` | `frontend/src/types/tournament.dto.ts` |
