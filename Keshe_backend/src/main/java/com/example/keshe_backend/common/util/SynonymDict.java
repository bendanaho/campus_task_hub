package com.example.keshe_backend.common.util;

import java.util.*;

/**
 * 校园互助场景的手工同义词词典：把搜索关键词扩展为一组近义词，让"台灯"也能搜到"照明/护眼灯"。
 * 低成本、无外部依赖；后续按需往 GROUPS 里加组即可。
 */
public class SynonymDict {

    private static final List<Set<String>> GROUPS = List.of(
            Set.of("快递", "取件", "包裹", "代取", "驿站", "菜鸟"),
            Set.of("外卖", "取餐", "代买饭", "带饭", "食堂打饭"),
            Set.of("台灯", "照明", "护眼灯", "灯具"),
            Set.of("打印", "复印", "文印", "打印资料", "打印材料"),
            Set.of("家教", "辅导", "答疑", "补习", "陪学", "讲题"),
            Set.of("维修", "修理", "修电脑", "装系统", "重装", "修手机"),
            Set.of("搬运", "搬家", "搬东西", "帮搬", "搬行李"),
            Set.of("占座", "占位", "抢座", "留座"),
            Set.of("组队", "搭子", "队友", "结伴", "合作", "组团"),
            Set.of("二手", "闲置", "转卖", "出闲置", "低价出"),
            Set.of("代购", "代买", "帮买", "捎带"),
            Set.of("设计", "作图", "ps", "海报", "logo"),
            Set.of("编程", "代码", "程序", "写代码", "debug", "调试"),
            Set.of("拍照", "摄影", "跟拍", "拍摄", "约拍"),
            Set.of("翻译", "润色", "校对", "改论文"),
            Set.of("兼职", "招人", "帮忙", "干活")
    );

    /**
     * 把关键词扩展为近义词列表（含关键词本身）。命中规则：关键词与组内某词互为包含即命中该组。
     */
    public static List<String> expand(String keyword) {
        String kw = keyword == null ? "" : keyword.trim().toLowerCase();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (kw.isEmpty()) return new ArrayList<>(out);
        out.add(kw);
        for (Set<String> group : GROUPS) {
            boolean hit = group.stream().anyMatch(w -> kw.contains(w) || w.contains(kw));
            if (hit) out.addAll(group);
        }
        return new ArrayList<>(out);
    }
}
