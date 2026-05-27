package com.aiaccountant.backend.service;

import java.util.Set;

final class PresentationOptions {
    static final Set<String> FINANCE_ICONS = Set.of(
        "utensils",
        "bus",
        "shopping-bag",
        "gamepad",
        "receipt",
        "heart-pulse",
        "wallet",
        "briefcase",
        "gift",
        "sparkles",
        "tag",
        "more-horizontal"
    );

    static final Set<String> GOAL_ICONS = Set.of(
        "plane",
        "home",
        "graduation-cap",
        "sparkles",
        "piggy-bank",
        "gift",
        "wallet",
        "target",
        "heart-handshake",
        "more-horizontal"
    );

    static final Set<String> COLORS = Set.of(
        "#FF8C94",
        "#64B5F6",
        "#FFD54F",
        "#BA68C8",
        "#7ACB9C",
        "#FFB87A",
        "#A1887F",
        "#4DB6AC",
        "#F27C8B",
        "#8C9EFF"
    );

    private PresentationOptions() {
    }
}
