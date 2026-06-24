# Classifier Parity Report

Generated: 2026-06-24T11:23:57.801Z

## Summary

- Snapshot cards: 17491
- Mapped cards: 17491
- Mapping failures: 0
- Comparable cards: 6451
- Divergent cards: 225 (3.49%)
- Comparable family checks: 7177
- Mismatched family checks: 233 (3.25%)
- Direction: research-only 58, runtime-only 175

## Mapping

| Research EventFamily | Runtime RuleTag | Rationale |
| --- | --- | --- |
| enters | `trigger.etb`, `trigger.etb-other`, `trigger.landfall` | Runtime splits self, watcher, and landfall entry triggers. |
| dies | `trigger.death`, `trigger.death-other` | Runtime splits self-death and watcher death triggers. |
| leaves | `trigger.leaves`, `trigger.leaves-other` | Runtime splits self and watcher leaves-the-battlefield triggers (CR 603.6c). |
| cast | `trigger.cast`, `trigger.cast-watcher` | Runtime splits spell-local and battlefield watcher cast triggers. |
| attacks | `trigger.attack`, `trigger.attack-watcher` | Runtime splits attacker-local and battlefield watcher attack triggers. |
| draw | `trigger.draw` | Both sides represent draw-trigger conditions. |
| sacrifice | `trigger.sacrifice` | Both sides represent sacrifice-trigger conditions. |

## Allowed Differences

| Axis | Research classifier | Runtime classifier | Rationale |
| --- | --- | --- | --- |
| observer | ObserverScope(any/controlled-set/opponent/self/unknown) | no observer axis | Runtime trigger tags encode event kind, not observer scope. |
| risk/layer/confidence | no risk or automation metadata | RuleRisk, RuleAutomationLayer, confidence | Metadata axes are intentionally outside event-family parity. |
| unmapped event families | zone, blocks, discard, tap, counter, life, other | no corresponding trigger tags | Runtime has no same-granularity trigger tag for these families. |
| phase | all beginning-of phase/step triggers | trigger.upkeep and trigger.end-step only | Research phase is broader than the two runtime phase tags. |
| damage | combat and noncombat damage triggers | trigger.combat-damage only | Research damage is broader than runtime combat damage. |

## Per-family Divergence

| Family | Checks | Mismatches | Rate | Research only | Runtime only |
| --- | ---: | ---: | ---: | ---: | ---: |
| enters | 3732 | 57 | 1.53% | 36 | 21 |
| dies | 774 | 48 | 6.20% | 15 | 33 |
| leaves | 204 | 15 | 7.35% | 0 | 15 |
| cast | 906 | 72 | 7.95% | 0 | 72 |
| attacks | 1349 | 39 | 2.89% | 6 | 33 |
| draw | 116 | 2 | 1.72% | 1 | 1 |
| sacrifice | 96 | 0 | 0.00% | 0 | 0 |

## Mismatch Examples (top 30)

| Card | EDHREC rank | Direction/family | Research families | Runtime trigger tags |
| --- | ---: | --- | --- | --- |
| 《Path of Ancestry》 | 14 | runtime-only:cast |  | trigger.cast |
| 《Morbid Opportunist》 | 257 | research-only:dies | dies |  |
| 《Welcoming Vampire》 | 429 | research-only:enters | enters |  |
| 《Trouble in Pairs》 | 630 | research-only:draw | attacks, cast, draw | trigger.cast, trigger.attack, trigger.attack-watcher |
| 《Caretaker's Talent》 | 662 | research-only:enters | enters, other |  |
| 《Curse of Opulence》 | 709 | research-only:attacks | attacks |  |
| 《Enduring Innocence》 | 803 | research-only:enters | dies, enters | trigger.death |
| 《Tocasia's Welcome》 | 874 | research-only:enters | enters |  |
| 《Ugin, the Ineffable》 | 1025 | runtime-only:leaves |  | trigger.leaves-other |
| 《Buster Sword》 | 1102 | runtime-only:cast | damage | trigger.cast, trigger.combat-damage |
| 《Kambal, Profiteering Mayor》 | 1133 | research-only:enters | enters |  |
| 《Tarrian's Soulcleaver》 | 1144 | runtime-only:leaves | dies | trigger.death, trigger.death-other, trigger.leaves-other |
| 《Losheel, Clockwork Scholar》 | 1520 | research-only:enters | enters |  |
| 《The Skullspore Nexus》 | 1562 | research-only:dies | dies |  |
| 《Elvish Warmaster》 | 1721 | research-only:enters | enters |  |
| 《Ingenious Artillerist》 | 1828 | research-only:enters | enters |  |
| 《Uthros Research Craft》 | 2083 | runtime-only:cast |  | trigger.cast, trigger.cast-watcher |
| 《Thunderclap Drake》 | 2110 | runtime-only:cast |  | trigger.cast |
| 《Outpost Siege》 | 2233 | runtime-only:leaves |  | trigger.upkeep, trigger.leaves-other |
| 《Summon: Fenrir》 | 2271 | runtime-only:cast |  | trigger.cast |
| 《Spiteful Banditry》 | 2332 | research-only:dies | dies, enters | trigger.etb |
| 《Mirrodin Besieged》 | 2399 | runtime-only:cast |  | trigger.cast, trigger.end-step, trigger.cast-watcher |
| 《Together Forever》 | 2434 | runtime-only:dies | enters | trigger.etb, trigger.death |
| 《Vat of Rebirth》 | 2465 | runtime-only:leaves | dies | trigger.death, trigger.death-other, trigger.leaves-other |
| 《Tinybones, the Pickpocket》 | 2523 | runtime-only:cast | damage | trigger.cast, trigger.combat-damage |
| 《Twinferno》 | 2554 | runtime-only:cast |  | trigger.cast |
| 《Struggle for Project Purity》 | 2643 | runtime-only:attacks |  | trigger.attack, trigger.upkeep, trigger.attack-watcher |
| 《Pyromancer's Goggles》 | 2790 | runtime-only:cast |  | trigger.cast |
| 《Light-Paws, Emperor's Voice》 | 3014 | runtime-only:cast | enters | trigger.etb, trigger.cast-watcher, trigger.etb-other |
| 《Satoru, the Infiltrator》 | 3076 | research-only:enters | enters |  |

## All Mismatch Cards

- b473e293-59e3-4e04-acf2-622604aeb25f — 《Path of Ancestry》 — runtime-only:cast
- 322f44f0-e6da-4ee0-b474-e7d5e9a461c5 — 《Morbid Opportunist》 — research-only:dies
- 605c1ee0-5e8a-4e0a-a99b-42a38873f822 — 《Welcoming Vampire》 — research-only:enters
- f349f58b-8cc8-45e4-9565-2b46fdf976c9 — 《Trouble in Pairs》 — research-only:draw
- c97957a2-8310-4cff-8aad-871b7901d124 — 《Caretaker's Talent》 — research-only:enters
- ba0d3df2-3acf-46d7-8d64-8d67d1579adc — 《Curse of Opulence》 — research-only:attacks
- 98a389f4-2905-47f3-b60e-3d4afb3e5cb0 — 《Enduring Innocence》 — research-only:enters
- 25c983e0-a8c9-4784-91a4-8fe04c6df882 — 《Tocasia's Welcome》 — research-only:enters
- 18bdc181-9592-4147-81fb-7f83ce137f70 — 《Ugin, the Ineffable》 — runtime-only:leaves
- 5e060d58-4d6e-425c-b7d4-727669fcce5b — 《Buster Sword》 — runtime-only:cast
- 619e0686-e88c-4238-8364-75395e733533 — 《Kambal, Profiteering Mayor》 — research-only:enters
- 2ffb38ec-5852-4e91-85a5-cfccd1f23556 — 《Tarrian's Soulcleaver》 — runtime-only:leaves
- f8c2a972-e38f-47e5-a355-6f30ad09b1ae — 《Losheel, Clockwork Scholar》 — research-only:enters
- ba26ff0a-e714-44f2-95cf-1a5a6088edf9 — 《The Skullspore Nexus》 — research-only:dies
- bda83ef4-e345-495d-878c-4da171f997ba — 《Elvish Warmaster》 — research-only:enters
- 752c7723-90f8-4e3a-8266-f251ee0dadd8 — 《Ingenious Artillerist》 — research-only:enters
- e1c9783a-1d1b-40d7-872e-0ca11b229ce6 — 《Uthros Research Craft》 — runtime-only:cast
- 88d0a394-79e2-42ac-9a37-1a7b78231941 — 《Thunderclap Drake》 — runtime-only:cast
- ebb24fc7-dc71-4712-8c2a-b5920f78e55d — 《Outpost Siege》 — runtime-only:leaves
- 3509171e-8d7d-4e9e-97a1-58e6c7d225ed — 《Summon: Fenrir》 — runtime-only:cast
- fde2653f-5270-4b8f-9642-0835dbb076c2 — 《Spiteful Banditry》 — research-only:dies
- 674e2683-31c0-4fee-95fb-98b1201e41e7 — 《Mirrodin Besieged》 — runtime-only:cast
- 36b19ec0-d581-4213-bfae-1d7808a2f60d — 《Together Forever》 — runtime-only:dies
- 10c31317-71e8-42e0-85e0-3e64bd0c3dd3 — 《Vat of Rebirth》 — runtime-only:leaves
- 7bc4c7e2-6758-4a85-84e7-03ab93981106 — 《Tinybones, the Pickpocket》 — runtime-only:cast
- 93989dd7-2d3e-46e2-8e92-8d0479796087 — 《Twinferno》 — runtime-only:cast
- 5958e9e3-9457-48e1-afc1-a5c89e3b0ed0 — 《Struggle for Project Purity》 — runtime-only:attacks
- f76bcbfe-483f-4e63-8425-76feca1abf3e — 《Pyromancer's Goggles》 — runtime-only:cast
- 1718a442-b878-4690-b608-a013de3d79fc — 《Light-Paws, Emperor's Voice》 — runtime-only:cast
- 7555c429-5f2d-4171-b6b0-8e3c8da7f314 — 《Satoru, the Infiltrator》 — research-only:enters
- 4cfaa5cf-cc3d-49a7-9544-38a8bb7e9ec1 — 《Frontier Siege》 — runtime-only:enters
- afc9436b-8cad-4916-929d-ff33a37b42d5 — 《Dawnsire, Sunstar Dreadnought》 — runtime-only:attacks
- e0bdfbb4-3060-4492-bd9b-0c47e719400a — 《Jumbo Cactuar》 — runtime-only:attacks
- 31061e34-042e-40c3-99ab-752795ab4324 — 《Hollowmurk Siege》 — runtime-only:attacks
- 13b96709-0e88-476b-9485-956e682bb818 — 《Scaled Nurturer》 — runtime-only:cast
- 33a90122-7280-4481-9b97-5879194cae40 — 《Dalkovan Encampment》 — runtime-only:attacks
- c6f76fa7-095e-4bfe-a38c-5c4531880880 — 《Curse of Verbosity》 — research-only:attacks
- aefea339-8a0d-4531-8a62-afaecc88d078 — 《Scavenger's Talent》 — research-only:dies
- ba72d4a9-6f36-4796-bd71-2342fa9b4a30 — 《Yuna, Grand Summoner》 — runtime-only:cast
- b2f2645f-5f74-456a-bd02-83169d8b8a7e — 《Vraan, Executioner Thane》 — research-only:dies
- 3db40361-5f55-417e-a7cd-7e360cc91b4d — 《Chainsaw》 — research-only:dies
- 6cbd36d9-de47-41b0-9ef4-a72ca01adccd — 《Curse of Disturbance》 — research-only:attacks
- e25b516c-bf95-42bc-8b1e-04617a3d28df — 《Baron Bertram Graywater》 — research-only:enters
- 5eef3d70-ef16-4722-8c3d-21a0311597bd — 《Jade Orb of Dragonkind》 — runtime-only:enters, runtime-only:cast
- c098c507-5154-423a-a70b-f6dfd4959cf6 — 《Sunken Palace》 — runtime-only:cast
- f1eb489d-104c-4801-b6d2-3f1a7ee73a75 — 《Mechtitan Core》 — runtime-only:leaves
- 91df4cf5-d7ec-4fcd-87ed-e075ef6ceba9 — 《The Deck of Many Things》 — runtime-only:dies
- 40ab2b22-9cf6-4a73-a05f-6ce496d10bf7 — 《Bonus Round》 — runtime-only:cast
- 39e20898-cf01-48dc-8972-7ac500c3fa79 — 《Ghoulish Procession》 — research-only:dies
- e8e2f273-5e74-4f16-8d49-2e86e9c9f2dc — 《Solar Array》 — runtime-only:cast
- 2148820c-85b6-4598-adf2-10873001a779 — 《Summon: Good King Mog XII》 — runtime-only:cast
- f6479f7e-01f4-49f1-a444-04bf38934f6b — 《Marneus Calgar》 — research-only:enters
- b2d95950-18b3-463f-94f4-299e420751dc — 《Éomer, Marshal of Rohan》 — research-only:dies
- 1b600345-2b89-45bc-98c8-609fdd08a5fd — 《Merry, Warden of Isengard》 — research-only:enters
- 295a831c-490e-42ba-afc1-dab3524a4f0c — 《Glacierwood Siege》 — runtime-only:cast
- 52826984-44cb-48dc-a737-bb02983ffea8 — 《Glamdring》 — runtime-only:cast
- 5fe29c25-a7ad-4c79-a5a5-da1bbc832141 — 《Season of the Bold》 — runtime-only:cast
- 53643dd7-183b-4062-b7a3-e7723d23bdb0 — 《Company Commander》 — runtime-only:attacks
- c61ab8e1-ef23-465d-bcd3-f771434988b2 — 《Lapis Orb of Dragonkind》 — runtime-only:cast
- 23af0a0a-1d12-47c7-b191-2bd3f84eea93 — 《The Tenth Doctor》 — runtime-only:attacks
- ac50ef98-1791-4dd4-9c1f-8cea7db7ade5 — 《Maelstrom Archangel》 — runtime-only:cast
- 78df47c3-b771-4377-8963-ae3065fdcf8a — 《Waltz of Rage》 — runtime-only:dies
- ae9f5c80-bc96-4ab3-bb5b-e8bd470e9eab — 《Magus Lucea Kane》 — runtime-only:cast
- 32476743-c9d4-49ca-bec2-0669c215841b — 《Anrakyr the Traveller》 — runtime-only:cast
- c2008ba9-00df-4607-ba0c-189af52033eb — 《Mr. Foxglove》 — research-only:attacks
- 7fb88a5d-9b72-4da9-ade4-d09cadd7e1cb — 《Nuka-Nuke Launcher》 — runtime-only:cast
- 2ca969eb-3d79-4d1f-8d9d-7b8204ad166a — 《Starving Revenant》 — runtime-only:draw
- cbd483b5-5554-43ed-a729-535d01b0d5d3 — 《Jace Reawakened》 — runtime-only:cast
- 95d018f4-7f97-4b2c-abb4-cef69031caa1 — 《Dalek Drone》 — runtime-only:enters
- 1829f1dc-1fa9-4361-b318-d4dee280e6fd — 《Anje, Maid of Dishonor》 — research-only:enters
- 0177b410-b559-491f-b393-ac3ed774653c — 《Kotis, Sibsig Champion》 — research-only:enters
- e83a629e-2d74-48e2-ad4d-f390067cc51a — 《Transcendent Dragon》 — runtime-only:cast
- 6107f9aa-3373-4166-b4b8-a26fd6d69c72 — 《Showdown of the Skalds》 — runtime-only:cast
- b2f9e07b-64b7-40b3-9a5e-5f1d59b35af7 — 《Thopter Shop》 — research-only:dies
- fcc7ed01-ff64-4ffe-9b83-daa4132fd92d — 《Commander Liara Portyr》 — runtime-only:cast
- 4c05b382-58ab-4a2d-a81c-408ea273b6b6 — 《Dreadhorde Arcanist》 — runtime-only:cast
- 5b3326a5-18c5-4d45-90e1-f6d00ca2bced — 《Kelsien, the Plague》 — runtime-only:dies
- 83f776d9-f3b6-40c2-8008-1ace4d110825 — 《Barret, Avalanche Leader》 — runtime-only:enters
- b6b22bac-853a-45a8-a74d-9904ec2b34fd — 《Summon: G.F. Cerberus》 — runtime-only:cast
- 2274c7ae-5a40-4fd4-a4ac-6f56b23034e4 — 《Jace, Architect of Thought》 — runtime-only:attacks
- fcd54631-ea47-49a7-ad5f-9a9a51a815ba — 《Unstable Glyphbridge // Sandswirl Wanderglyph》 — runtime-only:attacks
- ddbacb74-1f98-4607-a92e-d14973b9d0ef — 《Groundswell》 — runtime-only:enters
- d7035db0-4bde-4ba3-9028-dd14191c8126 — 《Elvish Archivist》 — research-only:enters
- ed7ba558-5341-4c7b-a9c5-b382dee88a13 — 《Crackling Spellslinger》 — runtime-only:cast
- 91596da5-5b1a-430c-a878-7757ae366b6b — 《Battle of Hoover Dam》 — runtime-only:dies
- bab5e9ce-6d55-4d1e-a9ac-c2b954191be9 — 《Summon: Brynhildr》 — runtime-only:cast
- 8933297c-62f1-4df9-91b8-2d3481db77e5 — 《Spider-Man India》 — runtime-only:cast
- 118da256-d1ea-44e8-9026-317e49694d29 — 《Forger's Foundry》 — runtime-only:cast
- a728685f-8670-4db2-ae02-3cf74eb3c402 — 《Ran and Shaw》 — research-only:enters
- 27a4b633-5a62-4d8c-8cc6-44959c311de9 — 《Cryptek》 — runtime-only:dies
- 494dc919-e429-491b-b19b-5037499e2dd6 — 《Bygone Marvels》 — runtime-only:cast
- 821e8648-222c-4b33-a8bd-e8bfff7dcd9e — 《Quistis Trepe》 — runtime-only:cast
- 8419d1d5-bb0e-4a2d-bb6f-67957d035dde — 《Thunder of Unity》 — runtime-only:enters
- b6689782-08d8-48e1-a05d-cd040dfe85bc — 《Curse of Bounty》 — research-only:attacks
- de861715-fd0b-493e-9a7c-c470a23044c0 — 《J. Jonah Jameson》 — research-only:enters
- 481c3e14-b670-4fab-aa9f-6ce5b514096d — 《Aang and Katara》 — research-only:enters
- bbdb731d-c533-48ef-b82a-cf1a8ba36208 — 《The Sibsig Ceremony》 — runtime-only:cast
- df72b5d6-6f9e-4d6b-acf6-7dec4ff35468 — 《Bess, Soul Nourisher》 — research-only:enters
- a3e10b9b-9349-4b44-a46c-c825293dbd05 — 《The Dawning Archaic》 — runtime-only:cast
- 14c2c818-0ce2-4809-a5ff-ee4a6253defa — 《Oskar, Rubbish Reclaimer》 — runtime-only:cast
- f74d8f53-a239-4641-90f1-bf786d57e253 — 《Brass Infiniscope》 — runtime-only:cast
- 7849426d-895d-4dfe-a94d-b8df634618a5 — 《Apple of Eden, Isu Relic》 — runtime-only:cast
- f0554a8f-32de-4069-9f47-5e06ceb3f09d — 《Aloy, Savior of Meridian》 — runtime-only:attacks
- 2458aa66-5b20-4811-a4a4-8375ad0a6498 — 《Jaya, Fiery Negotiator》 — runtime-only:attacks
- 2158c73d-421b-4c94-af06-dd89cb8d3126 — 《Jeong Jeong, the Deserter》 — runtime-only:cast
- 6cd03270-54cc-43e1-9b86-70c76960c841 — 《Wernog, Rider's Chaplain》 — runtime-only:leaves
- 3ec7ae18-b203-49bd-95f9-ad5482459a23 — 《Mirror of Life Trapping》 — runtime-only:cast
- a9a35c77-637f-4d56-afa2-6c8a4ded4838 — 《Stinging Cave Crawler》 — runtime-only:attacks
- 20f92504-d03c-437e-9814-b25ee384b3ba — 《Butch DeLoria, Tunnel Snake》 — runtime-only:attacks
- be0a3925-8e0d-4ef6-85cb-c9f5eef6b4bb — 《Turn Inside Out》 — runtime-only:dies
- 67a9357c-4713-4e01-a60d-532bf0dd80b6 — 《Codie, Vociferous Codex》 — runtime-only:cast
- 4900c157-8d9f-4f92-aaca-5246b6e2832e — 《April O'Neil, Live on the Scene》 — runtime-only:enters
- 0332f7b5-dad3-4fd0-b86c-78bd8301f59d — 《Gnawing Crescendo》 — runtime-only:dies
- 860b5e4c-45bd-4ba1-930a-36a1450ebd37 — 《Infested Thrinax》 — runtime-only:dies
- 2a7504b9-220d-412e-9381-b6a8a3750241 — 《Najal, the Storm Runner》 — runtime-only:cast
- f1f3df1c-5c51-445a-b66d-eee4aab23691 — 《Desperate Measures》 — runtime-only:dies
- 30c0df75-9822-4016-a52b-d2e69dd58124 — 《Galea, Kindler of Hope》 — runtime-only:cast
- 66d57851-2844-4b9d-be78-e90fc620b750 — 《Scarblade's Malice》 — runtime-only:dies
- aba60536-ffbd-480c-8e8f-9639bdc53d4b — 《Spectral Arcanist》 — runtime-only:cast
- c33e99c6-189e-4dcf-8b6a-64937dbad361 — 《Rimefire Torque》 — runtime-only:cast
- 8df7a58c-053f-4ead-a778-2747718e5f10 — 《Party Dude》 — research-only:attacks
- e1905321-180b-41d2-b7ef-0974ab90f188 — 《Felonious Rage》 — runtime-only:dies
- 0c4603be-d71a-4d33-b62c-04ead1987dbe — 《G'raha Tia》 — research-only:dies
- 0c85a577-db82-4a36-bc42-49644eba1cf2 — 《Zevlor, Elturel Exile》 — runtime-only:cast
- 75137acb-dc8e-439b-8d84-c5cf682ff6bc — 《Reckless Blaze》 — runtime-only:dies
- 169cf74a-07bf-4841-83f3-904df8a0a39b — 《Jailbreak》 — runtime-only:enters
- 158a6225-a246-4fd6-aa57-0df8067b4383 — 《Lutri, the Spellchaser》 — runtime-only:cast
- 94d5c904-6504-4df2-b242-daf88a988475 — 《The Pandorica》 — runtime-only:leaves
- ed77fdf2-59c0-4310-9b12-80d28beeaeef — 《Chocobo Camp》 — runtime-only:enters, runtime-only:cast
- 5193172c-9024-409e-bd9e-0387971d65fe — 《Boiling Rock Rioter》 — runtime-only:cast
- 535f9bc6-9a07-4850-91eb-c00d06633e7e — 《Coati Scavenger》 — runtime-only:enters
- cb4f65b0-2841-42bf-8e18-d04a3b9f1a76 — 《Epistolary Librarian》 — runtime-only:cast
- 2385c8fb-9c38-4ff3-8f61-4e25a8c7d46b — 《Krang & Shredder》 — research-only:enters
- 01376449-5cd2-4079-8aaa-5128634ef20b — 《Long List of the Ents》 — runtime-only:cast
- 675321d7-2cf0-4e0b-9517-d711b22865ab — 《Woodland Champion》 — research-only:enters
- 40f664d8-4c73-44aa-8fb1-d38771a42520 — 《Mysterio, Master of Illusion》 — runtime-only:leaves
- 9a6bf8a3-7640-4890-ac62-d5028f41978b — 《Rhino, Barreling Brute》 — runtime-only:cast
- 61f09fcc-11cd-4999-a43a-54488b19861d — 《Cloakwood Swarmkeeper》 — research-only:enters
- 566533af-5e67-463f-ac33-dfcf1ec735c9 — 《Ether》 — runtime-only:cast
- 4469ff35-54ec-4ff5-bc19-3808ae0f711b — 《Wildgrowth Archaic》 — runtime-only:enters
- 2494daad-c81d-4a80-ba5d-e7011af8de46 — 《Maeve, Insidious Singer》 — runtime-only:attacks
- 1196a4cb-544c-4e7b-91cd-f0820b21a80d — 《Lucy MacLean, Positively Armed》 — runtime-only:enters
- dc4d5602-47cb-47c8-8a43-3b840e12b79c — 《Homicide Investigator》 — research-only:dies
- 0d5bbde7-6f33-4708-b3ab-34d4528af649 — 《Magitek Scythe》 — runtime-only:enters
- d53d5d03-b180-4bdb-8801-260f8a75644d — 《Tamiyo Meets the Story Circle》 — runtime-only:attacks
- ad643992-eb9f-4a4a-9b74-a5aee2337f30 — 《Lo and Li, Twin Tutors》 — research-only:enters
- ca59fbf4-c774-49d3-8630-108c053e01fb — 《Whispersteel Dagger》 — runtime-only:cast
- 47b29cf9-8ef3-4b6a-a9a3-3ab822c5dea4 — 《Rinoa, Angel Wing》 — research-only:dies
- 00cfbea0-e862-468b-90d5-7478eb9847c0 — 《End-Blaze Epiphany》 — runtime-only:dies
- eae3e762-dacd-4bd2-923c-3abb5ceb729a — 《Aisha of Sparks and Smoke》 — runtime-only:cast
- c3a46eb3-38d9-4f47-9b71-26c9ea7ef1ce — 《The Dragon-Kami Reborn // Dragon-Kami's Egg》 — runtime-only:cast
- cc9088c4-6f6b-4a1a-90f1-794eb1e938c6 — 《Phenomenon Investigators》 — runtime-only:dies
- d49c94fa-712a-47c0-b571-4db7e064a590 — 《Ride the Avalanche》 — runtime-only:cast
- 7d3a0216-871b-4c1b-adb1-de99b832f577 — 《Ruinous Waterbending》 — runtime-only:dies
- 902b82fd-bb18-4833-b427-af8c9751f870 — 《Searing Blood》 — runtime-only:dies
- 74b08a70-b0bb-4340-98a0-b1d5b7c9d2cc — 《Searing Blaze》 — runtime-only:enters
- 202e45d6-8c7a-46db-85fb-634aa77b4097 — 《Fatal Fissure》 — runtime-only:dies
- 04e3d36f-5dec-422c-a371-15e135fdface — 《Blessed Defiance》 — runtime-only:dies
- 80312910-5d53-44f1-9982-e46dc7532abb — 《The Unbeatable Squirrel Girl》 — runtime-only:enters, runtime-only:attacks
- bd7111bc-9b8f-4c4b-b61c-7841a857ce6b — 《Cherished Hatchling》 — runtime-only:cast
- aa929252-5dcc-4c9b-9e7c-61d0bef98d6d — 《Blood Spatter Analysis》 — research-only:dies
- 25a9c864-59c6-4230-a234-bf78bf1ef24c — 《Malamet Veteran》 — runtime-only:attacks
- a4374baa-a846-4b34-afbf-6bb7feb4648c — 《Electric Seaweed》 — runtime-only:dies
- 0403bfb0-2174-4360-994d-68d8ca96fc55 — 《Nightmares and Daydreams》 — runtime-only:cast
- c649d5ae-2f38-4737-8123-8069a2ba0bde — 《Vengeful Townsfolk》 — research-only:dies
- 8a4d505e-b884-4b8b-93d5-495992f3858e — 《Sengir Connoisseur》 — research-only:dies
- b2bdccf1-857b-48f8-a9aa-8ef999ef0632 — 《Seer of Stolen Sight》 — runtime-only:leaves
- a0218a14-8301-4484-aed5-90334349620e — 《Warhost's Frenzy》 — runtime-only:dies
- 7b33368f-0668-4233-8bbf-725c66c771cb — 《Donnie & April, Adorkable Duo》 — research-only:enters
- 50d0d870-fe3d-44a2-ad6e-93307a1fb468 — 《Ace, Fearless Rebel》 — runtime-only:attacks
- c77ddcac-ce54-4348-bde2-5d9caf3d5b04 — 《Spiritcall Enthusiast // Scrollboost》 — research-only:enters
- c01095ba-b9c9-44e0-97d1-35cc47c4ed04 — 《Splinter & Leo, Father & Son》 — research-only:enters
- 59642d6f-8a25-4f79-9e81-643eac775658 — 《Time to Feed》 — runtime-only:dies
- e7b746c8-1b32-42ed-8328-4e16274209d8 — 《Kylox's Voltstrider》 — runtime-only:cast
- 7fa5237e-dd79-4646-b935-cb8c6ee803ab — 《Mister Fantastic, Reed Richards》 — research-only:enters
- 02718076-4c71-4bf5-988f-e6f94fbf0aef — 《Spara's Adjudicators》 — runtime-only:attacks
- 15e14a91-a596-465f-becc-cef2e7fbbd30 — 《Mikey & Mona, Mutant Sitters》 — research-only:enters
- 72a9a85d-7cfc-4b3c-82db-9d35be6c0982 — 《Bilbo, Thief in the Night》 — runtime-only:cast
- f2a6dc8d-3c98-44ae-aff0-b838d7aee0b7 — 《Sandstalker Moloch》 — runtime-only:cast
- f20a5297-31ba-4bbd-810e-be23175a116f — 《Casey & Raph, Hotheads》 — research-only:enters
- 8ec3c334-8a53-46d8-8cfb-c647c3a1ef74 — 《Stalked Researcher》 — runtime-only:attacks
- fdd4b3a9-83ce-41bf-82e2-7808657e2c09 — 《Transcendent Archaic》 — runtime-only:cast
- 7b513bd0-27df-45f3-a85f-1f0aba3cae48 — 《Council of Echoes》 — runtime-only:enters
- 739eac91-3029-4ce7-9885-0af3ddea472e — 《Stangg》 — runtime-only:leaves
- 03c47f1c-02a7-428c-a126-9e85325ebc71 — 《Heroic Sacrifice》 — runtime-only:dies
- a2281c99-3f45-441b-8e78-7f1f29bf1dcd — 《The Fantastic Four》 — research-only:enters
- 53129de9-4809-4c8c-9d11-37369899e70a — 《Fight for the Throne》 — runtime-only:dies
- 657c5473-f153-4dd2-94a0-d477cbc2451d — 《Helmut Zemo, Mastermind》 — runtime-only:cast
- 5b18d2fd-bc65-49a2-b812-c217f125571d — 《Initiate of Blood // Goka the Unjust》 — runtime-only:dies
- 9c78778a-6335-4949-8ade-11d0f085cb2b — 《Loki Laufeyson》 — runtime-only:cast
- e4f218b3-d96d-49c5-8dfa-8fcf993f795f — 《Truss, Chief Engineer》 — runtime-only:dies
- f81207e8-d5a2-4a5e-8a81-803ac563fe76 — 《Minotaur, Roxxon CEO》 — runtime-only:dies
- 64132f93-66ac-4794-8c07-a88f9ed0e22b — 《Cloak and Dagger, Entwined》 — research-only:enters
- 85dec6cf-6f27-4eb0-834b-5f6fbbe25fc8 — 《Spider-Man, To the Rescue》 — runtime-only:enters
- aaded61e-32c2-4e02-8557-3f8cd927a64e — 《Gert and Old Lace, Runaways》 — research-only:enters
- 74858500-8943-4ea7-894f-0cd022510bbe — 《Devil K. Nevil》 — research-only:enters
- 760d6cb2-5d8a-495c-9853-f96a1efa5775 — 《The Immortal Weapons》 — research-only:enters
- 2b6fa8b6-4865-4eb6-974b-00f6b16b6f0f — 《U.S.Agent, John Walker》 — research-only:enters
- 26a1b36c-3c27-4eb4-b85f-63459653b773 — 《Ms. Marvel, Elastic Ally》 — research-only:enters
- 7e06b7b4-22c1-4e5b-81ee-54ab5ac756eb — 《Carnival Elephant Meteor》 — runtime-only:attacks
- ba2bb276-b7ef-46ec-9618-2cf4d60c70a6 — 《Cool Fluffy Loxodon》 — runtime-only:enters, runtime-only:leaves
- 43f5ce56-6ad1-4a42-b1d7-26f1c7933693 — 《Deep-Fried Plague Myr》 — runtime-only:leaves, runtime-only:attacks
- 13d9822f-0398-4915-818b-b9fbaf63b93c — 《Demonic Tourist Laser》 — runtime-only:dies
- 5829ac8e-bd1c-4065-b30a-5307ab11ae79 — 《Elemental Time Flamingo》 — runtime-only:dies
- 41c0e1f1-8ebe-4cd2-96fe-e4bb625fe6ee — 《Familiar Beeble Mascot》 — runtime-only:enters, runtime-only:attacks
- c0a448ee-e5f9-4e57-85b0-f6d401018170 — 《Geek Lotus Warrior》 — runtime-only:enters
- 26f6170a-34dc-41c8-b3b1-20377f131e6e — 《Giant Mana Cake》 — runtime-only:dies, runtime-only:leaves
- 7cad08c1-4bd9-4d9f-85d2-fb3ab718fbb8 — 《Goblin Coward Parade》 — runtime-only:leaves
- 658252ed-7f52-4a31-834b-c39cee1d5e00 — 《Misunderstood Trapeze Elf》 — runtime-only:cast
- 366e0a62-ff95-48d1-bc63-7995a393bc34 — 《Narrow-Minded Baloney Fireworks》 — runtime-only:attacks
- dde09abb-e3d3-4c76-b7e8-812949dd67f3 — 《Phyrexian Midway Bamboozle》 — runtime-only:attacks
- 065cdf8d-6874-4ab6-a08e-79bd88b245bd — 《Playable Delusionary Hydra》 — runtime-only:attacks
- a7a00246-54e7-4213-b95b-907ab9015e53 — 《Primal Elder Kitty》 — runtime-only:dies
- 16663933-c8e2-4411-8eed-673c52fa3ecb — 《Sassy Gremlin Blood》 — runtime-only:attacks
- 3e5ac76b-08bd-4232-9290-49742b0ff603 — 《Snazzy Aether Homunculus》 — runtime-only:cast
- 3def54bf-2640-47de-84e8-7a9406df007e — 《Sticky Kavu Daredevil》 — runtime-only:dies, runtime-only:attacks
- 6ad4d181-21ce-47f3-9c00-2aa8c307e7fe — 《Unassuming Gelatinous Serpent》 — runtime-only:dies
- ea1fb0c3-d52c-4435-af2c-4b74f31189f7 — 《Unhinged Beast Hunt》 — runtime-only:attacks
- 989346e5-3e76-40ce-8295-d267929d4fd5 — 《Unique Charmed Pants》 — runtime-only:attacks
- 4413cb03-d6e9-4e6c-b5fe-9240ca0ebd13 — 《Unsanctioned Ancient Juggler》 — runtime-only:attacks
- 676de97a-299b-42ac-aa93-bb12dc9c4460 — 《Unstable Robot Dragon》 — runtime-only:attacks
- 2c925531-63f8-4a6b-bfe0-bb8cd5d0d63d — 《Weird Angel Flame》 — runtime-only:cast
- a72927dc-b633-4830-be39-40674ed74ef3 — 《Werewolf Lightning Mage》 — runtime-only:enters
- 578c23d2-225f-4488-be7f-4abe38297bde — 《Wild Ogre Bupkis》 — runtime-only:attacks
- 4c02ee30-8681-45ed-adb5-edf06409eee4 — 《Yawgmoth Merfolk Soul》 — runtime-only:leaves

## Notes

- Divergence is measured only for mapped event families; allowed axes are excluded from numerator and denominator.
- A mapped family agrees when the research family presence equals the presence of any corresponding runtime tag.
- `report.json` contains every card comparison and mismatch record for machine analysis.

