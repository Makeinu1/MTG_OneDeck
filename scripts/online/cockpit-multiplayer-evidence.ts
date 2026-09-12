import { launchO4p06fCdpBrowserV1, type O4p06fPageV1 } from './o4p-06f-four-browser-evidence.ts';
const seats = Number(process.env.COCKPIT_SEATS ?? 4);
if (![2, 4].includes(seats)) throw new Error('COCKPIT_SEATS must be 2 or 4');
const origin = process.env.COCKPIT_URL ?? 'http://127.0.0.1:5177/';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Local fixture evidence only');
const browser = await launchO4p06fCdpBrowserV1(20000);
const pages: O4p06fPageV1[] = [];
async function wait(page: O4p06fPageV1, expression: string, stage: string) {
  for (let i = 0; i < 100; i++) {
    if (await page.evaluate<boolean>(expression)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`UI_TIMEOUT:${stage}`);
}
async function click(page: O4p06fPageV1, text: string) {
  await wait(
    page,
    `Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled)`,
    `button:${text}`,
  );
  await page.evaluate(
    `(()=>{Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===argument&&!b.disabled).click();return true})()`,
    text,
  );
}
try {
  for (let i = 0; i < seats; i++) {
    const context = await browser.createBrowserContext();
    const page = await context.createPage();
    pages.push(page);
    await page.setViewport!({ width: 1440, height: 900 });
    await page.navigateForUiEvidence!(origin);
    await page.evaluate(
      `(async()=>{const {saveResolvedDeck}=await import('/src/data/savedDecks.ts');const entries=Array.from({length:100},(_,i)=>({quantity:1,section:'main',card:{scryfallId:'fixture-'+i,oracleId:'fixture-'+i,name:'Fixture '+i,printedName:'検証カード'+i,lang:'ja',layout:'normal',cmc:0,colorIdentity:[],typeLine:'Creature',faces:[{name:'Fixture '+i,printedName:'検証カード'+i,typeLine:'Creature',printedTypeLine:'クリーチャー',oracleText:'',printedText:'',power:'2',toughness:'2'}]}}));await saveResolvedDeck({deckText:'Cockpit local fixture',entries});return true})()`,
    );
    await page.navigateForUiEvidence!(origin);
    await wait(page, "document.querySelector('[data-testid=play-choice]')!==null", 'deck-library');
  }
  await click(pages[0], `${seats}人対戦を作成`);
  await wait(pages[0], "document.querySelector('input[aria-label=招待コード]')!==null", 'create');
  const invitation = await pages[0].evaluate<string>(
    "document.querySelector('input[aria-label=招待コード]').value",
  );
  for (let i = 1; i < seats; i++) {
    await pages[i].evaluate(
      `(()=>{const input=document.querySelector('input[aria-label="参加する招待コード"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,argument);input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`,
      invitation,
    );
    await click(pages[i], 'このデッキで参加');
    await wait(pages[i], `document.body.innerText.includes('OneDeck · ${seats}人対戦')`, 'join');
  }
  for (const page of pages) {
    await new Promise((r) => setTimeout(r, 1800));
    await click(page, '初手をキープ');
    await wait(
      page,
      "!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='初手をキープ')",
      'keep',
    );
  }
  await click(pages[0], '全員で対戦を開始');
  await wait(pages[0], "document.body.innerText.includes('あなたが卓を操作できます')", 'start');
  await click(pages[0], '1枚ドロー');
  await click(pages[1], 'HOLD・応答を要求');
  await click(pages[0], '操作権を貸す');
  await wait(
    pages[1],
    "document.body.innerText.includes('あなたが卓を操作できます')",
    'delegation',
  );
  await click(pages[1], '1枚ドロー');
  await click(pages[1], '操作権を返す');
  await click(pages[0], 'undo');
  await pages[seats - 1].navigateForUiEvidence!(origin);
  await wait(
    pages[seats - 1],
    `document.body.innerText.includes('OneDeck · ${seats}人対戦')`,
    'reload',
  );
  if (seats === 4) {
    for (const index of [2, 3]) {
      await pages[0].evaluate(
        `(()=>{document.querySelector('.cockpit-session__seats>article:nth-child('+argument+') button').click();return true})()`,
        index,
      );
      await click(pages[0], 'この領域を自分だけ閲覧');
      await wait(
        pages[0],
        "document.querySelectorAll('.cockpit-session__cards:not(.cockpit-session__board)>article input[type=checkbox]').length===7",
        'peek-defender',
      );
      await pages[0].evaluate(
        `(()=>{document.querySelector('.cockpit-session__cards:not(.cockpit-session__board)>article input[type=checkbox]').click();const input=document.querySelector('select[aria-label=移動先]');input.value='battlefield';input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`,
      );
      await click(pages[0], '選択を移動');
      await wait(
        pages[0],
        `document.querySelectorAll('.cockpit-session__seats>article:nth-child(${index}) .cockpit-session__board>article').length===1`,
        'defender-prepared',
      );
      await click(pages[0], '選択取消');
      await click(pages[0], '非公開の閲覧を閉じる');
    }
    await pages[0].evaluate(
      "(()=>{document.querySelector('.cockpit-session__seats>article button').click();return true})()",
    );
  }
  // Shared UI: put two fixture creatures on the board and declare separate attack fronts.
  await pages[0].evaluate(
    `(()=>{const boxes=Array.from(document.querySelectorAll('.cockpit-session__cards:not(.cockpit-session__board)>article input[type=checkbox]'));boxes.slice(0,2).forEach(b=>b.click());const input=document.querySelector('select[aria-label=移動先]');input.value='battlefield';input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`,
  );
  await click(pages[0], '選択を移動');
  await wait(
    pages[0],
    `document.querySelectorAll('.cockpit-session__board>article').length===${seats === 4 ? 4 : 2}`,
    'battlefield',
  );
  await pages[0].evaluate(
    `(()=>{Array.from(document.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent==='戦闘の関係・ダメージ割当').open=true;const targets=document.querySelectorAll('select[aria-label$=の攻撃先]');if(targets[1]){targets[1].value=argument===4?'P3':'P2';targets[1].dispatchEvent(new Event('change',{bubbles:true}));}return true})()`,
    seats,
  );
  await click(pages[0], '攻撃の登録内容を確認');
  await click(pages[0], '攻撃を登録');
  await wait(pages[0], "document.body.innerText.includes('確定済みの割当')", 'attack');
  if (seats === 4) {
    for (const index of [1, 2]) {
      const page = pages[index];
      await new Promise((r) => setTimeout(r, 1800));
      await wait(
        page,
        "Array.from(document.querySelectorAll('legend')).some(e=>e.textContent==='選択した防御カードのブロック先')",
        'defender-combat',
      );
      await page.evaluate(
        `(()=>{document.querySelector('.cockpit-session__seats>article:nth-child('+(argument+1)+') .cockpit-session__board input[type=checkbox]').click();const detail=Array.from(document.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent==='戦闘の関係・ダメージ割当');detail.open=true;detail.querySelectorAll('fieldset input[type=checkbox]')[argument-1].click();return true})()`,
        index,
      );
      await click(page, '選択したカードのブロックを登録');
      await wait(
        page,
        `Array.from(document.querySelectorAll('button')).filter(b=>b.textContent==='このブロックを外す').length===${index}`,
        'independent-block',
      );
    }
    await new Promise((r) => setTimeout(r, 1800));
  }
  await pages[0].evaluate(
    `(()=>{const labels=Array.from(document.querySelectorAll('label'));const source=labels.find(l=>l.textContent.trim().startsWith('ダメージの発生源')).querySelector('select');source.value=source.options[1].value;source.dispatchEvent(new Event('change',{bubbles:true}));const target=labels.find(l=>l.textContent.trim().startsWith('ダメージの対象')).querySelector('select');target.value=argument===4?Array.from(target.options).find(o=>o.value!=='P2'&&o.textContent.includes('プレイヤー2')).value:'P2';target.dispatchEvent(new Event('change',{bubbles:true}));const amount=labels.find(l=>l.textContent.trim().startsWith('割当ダメージ')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(amount,'2');amount.dispatchEvent(new Event('input',{bubbles:true}));return true})()`,
    seats,
  );
  await click(pages[0], '割当案へ追加');
  await click(pages[0], 'この割当を確定');
  await click(pages[0], '確定したダメージを一括反映');
  await wait(
    pages[0],
    "document.body.innerText.includes('反映済み。再適用しません。')",
    'damage-once',
  );
  await click(pages[0], '戦闘の処理を終える');
  await click(pages[0], '次のフェイズ');
  await wait(
    pages[0],
    "document.querySelector('header.cockpit-session__bar>span').textContent.includes('第2メイン')",
    'host-phase-committed',
  );
  const progress = await pages[0].evaluate<string>(
    "document.querySelector('header.cockpit-session__bar>span').textContent",
  );
  const summaries = [];
  for (const page of pages) {
    await wait(
      page,
      `document.querySelector('header.cockpit-session__bar>span').textContent===${JSON.stringify(progress)}`,
      'convergence',
    );
    summaries.push(
      await page.evaluate(
        "({seats:document.querySelectorAll('.cockpit-session__seats>article').length,cards:document.querySelectorAll('.cockpit-session__cards>article').length,overflow:document.documentElement.scrollWidth>innerWidth})",
      ),
    );
  }
  for (const [width, height] of [
    [1440, 900],
    [812, 375],
    [375, 812],
  ]) {
    await pages[0].setViewport!({ width, height });
    if (await pages[0].evaluate('document.documentElement.scrollWidth>innerWidth'))
      throw new Error(`OVERFLOW:${width}`);
  }
  // Irreversible exit uses the visible confirmation and closes the room at one remaining seat.
  await pages[0].setViewport!({ width: 1440, height: 900 });
  for (let i = seats; i >= 2; i--) {
    await pages[0].evaluate(
      `(()=>{const detail=Array.from(document.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent==='参加状態・脱落・退出');detail.open=true;const row=Array.from(detail.querySelectorAll('p')).find(p=>p.textContent.startsWith('プレイヤー'+argument+':'));Array.from(row.querySelectorAll('button')).find(b=>b.textContent==='脱落を確認').click();return true})()`,
      i,
    );
    await click(pages[0], '取消不可の確定');
    await wait(pages[0], "!document.querySelector('[role=alert]')", 'eliminate');
  }
  for (const page of pages)
    await wait(page, "document.body.innerText.includes('終局確定済み')", 'end-convergence');
  console.log(
    JSON.stringify({
      result: 'PASS',
      contexts: seats,
      journey: [
        'create',
        'join',
        'keep',
        'start',
        'draw',
        'hold',
        'grant',
        'return',
        'undo',
        'reload',
        'attack',
        ...(seats === 4 ? ['private-peek', 'independent-defenders'] : []),
        'damage-once',
        'battle-end',
        'phase-convergence',
        'eliminate',
        'end-convergence',
      ],
      summaries,
      console: pages.map((p) => p.consoleCounts()),
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      result: 'FAIL',
      error: error instanceof Error ? error.message : 'unknown',
      progress: await Promise.all(
        pages.map((p) =>
          p.evaluate("document.querySelector('header.cockpit-session__bar>span')?.textContent"),
        ),
      ),
      statuses: await Promise.all(
        pages.map((p) =>
          p.evaluate(
            "Array.from(document.querySelectorAll('[role=status]')).map(e=>e.textContent)",
          ),
        ),
      ),
      console: pages.map((p) => p.consoleCounts()),
    }),
  );
  process.exitCode = 1;
} finally {
  for (const page of pages) await page.close();
  await browser.close();
}
