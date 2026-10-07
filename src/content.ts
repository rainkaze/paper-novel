export type Block = { id: string; type: 'heading' | 'paragraph' | 'blank'; text: string };

const seedBlocks: Block[] = [
  { id: 'h-1', type: 'heading', text: '1 引言：纸张边缘的微光' },
  { id: 'p-1', type: 'paragraph', text: '夜班结束时，城市的灯还没有完全熄灭。林岑把最后一页报告夹在书里，走进研究所北侧那条很少有人经过的长廊。玻璃窗上映着他的影子，影子比本人稍微迟疑一些，仿佛正在重新考虑下一步应该走向哪里。' },
  { id: 'p-2', type: 'paragraph', text: '他一直相信，故事有自己的结构。人物在某个时刻相遇，某个秘密被有意或无意地留下，章节像桥一样把不可见的河流分隔开来。可是，当他开始记录那场雨以后，所有熟悉的秩序都变得不再可靠。' },
  { id: 'blank-1', type: 'blank', text: '' },
  { id: 'h-2', type: 'heading', text: '2 相关观察与现场记录' },
  { id: 'p-3', type: 'paragraph', text: `“你确定要把它写下来吗？”苏遥问。她站在门边，手里拿着一只没有盖子的钢笔。

“如果不写下来，它就只是一种感觉。”林岑回答，“感觉会消失，但句子会留下。”

“句子也会被误读。”

“那就让它暂时被误读。”` },
  { id: 'p-4', type: 'paragraph', text: '记录显示，23:47:08，走廊尽头的灯闪烁了三次；23:47:12，自动门打开；23:47:13，门外没有人。屏幕右下角的时间是 2026-10-07，温度 18.4°C。英文备注写着：observation remains inconclusive, but the pattern is repeatable.' },
  { id: 'p-5', type: 'paragraph', text: '研究并不总是从答案开始。更多时候，它从一个不够准确的问题开始：为什么每个人都记得那扇门，却没有人记得门后的房间？林岑将这个问题写在纸张的上方，下面留出两行空白，然后继续沿着墙上的阴影往前走。' },
  { id: 'h-3', type: 'heading', text: '3 方法：把不确定性排列整齐' },
  { id: 'p-6', type: 'paragraph', text: '为了避免记忆在叙述过程中自行修饰，研究小组采用了逐段记录的方法。每一段文字都保留原来的顺序，所有删改另行标注；人物的停顿使用破折号，无法确认的声音使用方括号。这个方法并不保证真实，却保证了后来的人可以看见不确定性曾经出现在哪里。' },
  { id: 'p-7', type: 'paragraph', text: '纸张被分为两栏，左栏记录发生过的事情，右栏记录观察者当时的判断。两栏之间留有一条窄窄的空隙，像是结论与证据之间必须保留的距离。由于窗口、字体和行距会不断变化，任何页码都只能被视为一个暂时的坐标，而不能被视为故事本身。' },
  { id: 'h-4', type: 'heading', text: '4 结果：门仍然留在原处' },
  { id: 'p-8', type: 'paragraph', text: '第三次实验结束后，门没有移动，房间也没有消失。变化只发生在阅读者身上：当文字被安排在一张洁白的纸上，原本喧闹的情节突然获得了缓慢的节奏。每一个段落都像一枚小型证据，等待被重新放回它应在的位置。' },
  { id: 'p-9', type: 'paragraph', text: '苏遥在报告末尾写道，任何形式都不能替内容作证；但合适的形式可以让内容更容易被看见。她没有给出摘要，也没有替故事解释意义，只在最后一页留下了一个页码，以及一句没有句号的话：请继续阅读' },
  { id: 'h-5', type: 'heading', text: '5 讨论与结论' },
  { id: 'p-10', type: 'paragraph', text: '这段记录的价值不在于它是否能够证明某件超出日常经验的事情，而在于它保留了观察、迟疑和继续观察之间的间隔。小说仍然是小说，纸张也仍然是纸张；改变的只是阅读者进入文本时所携带的期待。' },
];

const paragraphTail = '后来，林岑发现窗外已经天亮。新的光线覆盖了旧的阴影，却没有抹掉它们的边界。他把这一段写进记录，又在下一页重复了一遍，因为重复本身也是一种观察。';

export function buildDocument(repeat = 1): Block[] {
  const result = [...seedBlocks];
  for (let i = 0; i < repeat; i += 1) {
    result.push({ id: `h-repeat-${i}`, type: 'heading', text: `${6 + i} 附录：重复观察 ${i + 1}` });
    for (let j = 0; j < 7; j += 1) {
      result.push({ id: `p-repeat-${i}-${j}`, type: 'paragraph', text: `${paragraphTail} ${seedBlocks[(j + i) % seedBlocks.length].text}` });
    }
  }
  return result;
}

export const testSizes = [
  { label: '约 1 万字', repeat: 7 },
  { label: '约 5 万字', repeat: 50 },
];
