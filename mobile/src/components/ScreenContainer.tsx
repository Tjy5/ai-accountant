import React, { ReactNode } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

// ============================================
// ScreenContainer - Fusion Design System
// 统一封装 渐变头部 + 负边距重叠 + 滚动 + 安全区域
// ============================================

type HeaderType = 'large' | 'standard' | 'mini' | 'hidden' | 'jumbo';

export interface ScreenContainerProps {
  // 头部配置
  headerType?: HeaderType;
  headerTitle?: string;
  headerSubtitle?: string;
  headerRight?: ReactNode;
  headerGradient?: string[]; // 允许覆盖默认渐变，实现功能色区分
  headerContent?: ReactNode; // 自定义头部内容（用于大数字显示等）

  // 内容配置
  children: ReactNode;
  enableScroll?: boolean;
  refreshControl?: React.ReactElement;
  contentStyle?: ViewStyle;

  // 底部配置
  useSafeBottom?: boolean;

  // 自定义样式
  style?: ViewStyle;
}

const HEADER_HEIGHTS = {
  large: 280,
  standard: 180,
  mini: 120,
  hidden: 0,
  jumbo: Math.round(Dimensions.get('window').height * 0.45),
};

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  headerType = 'standard',
  headerTitle,
  headerSubtitle,
  headerRight,
  headerGradient,
  headerContent,
  children,
  enableScroll = true,
  refreshControl,
  contentStyle,
  useSafeBottom = true,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const headerHeight = HEADER_HEIGHTS[headerType];

  // 获取渐变色（默认使用标准深色渐变）
  const gradient = headerGradient || theme.colors.wealth?.gradients?.header || ['#1E293B', '#0F172A'];

  // 计算内容区域的负边距，实现悬浮卡片效果
  // jumbo 类型需要更小的负边距以避免与 header 内容重叠
  const overlapMargin = headerType === 'hidden' ? 0 : headerType === 'jumbo' ? -20 : -50;

  // 计算内容区域的paddingTop，jumbo类型需要更大的空间
  const paddingTopMultiplier = headerType === 'jumbo' ? 0.9 : 0.7;
  const calculatedPaddingTop = Math.max(headerHeight * paddingTopMultiplier + insets.top, insets.top + 20);

  const ContentWrapper = enableScroll ? ScrollView : View;
  const contentWrapperProps = enableScroll
    ? {
      contentContainerStyle: [
        styles.contentContainer,
        { paddingTop: calculatedPaddingTop },
        contentStyle,
      ],
      refreshControl,
      showsVerticalScrollIndicator: false,
    }
    : {
      style: [
        styles.contentContainer,
        { paddingTop: calculatedPaddingTop },
        contentStyle,
      ],
    };

  return (
    <View style={[styles.container, style]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* 渐变头部层 */}
      {headerType !== 'hidden' && (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.header,
            {
              height: headerHeight + insets.top,
              paddingTop: insets.top,
              borderBottomLeftRadius: headerType === 'large' ? theme.radii.xl : theme.radii.lg,
              borderBottomRightRadius: headerType === 'large' ? theme.radii.xl : theme.radii.lg,
            },
          ]}
        >
          {/* 自定义头部内容（优先级最高） */}
          {headerContent ? (
            headerContent
          ) : (
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                {headerTitle && (
                  <View>
                    <View style={styles.titleRow}>
                      <View style={[styles.titleDot, { backgroundColor: theme.colors.primary }]} />
                      <View style={styles.headerTitles}>
                        {headerSubtitle && (
                          <View style={styles.subtitleRow}>
                            <View style={[styles.subtitleDot]} />
                            <View style={styles.subtitleContainer}>
                              <View style={[styles.subtitleLine, { width: '60%' }]} />
                              <View style={[styles.subtitleLine, { width: '40%' }]} />
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </View>
              {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
            </View>
          )}
        </LinearGradient>
      )}

      {/* 内容层 - 使用负边距实现悬浮效果 */}
      <ContentWrapper {...contentWrapperProps}>
        <View style={[styles.overlapContent, { marginTop: overlapMargin, zIndex: 10 }]}>
          {children}
        </View>
        {useSafeBottom && <View style={{ height: insets.bottom + 20 }} />}
      </ContentWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    ...theme.shadows.medium,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    marginTop: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  titleDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: theme.spacing.sm,
  },
  headerTitles: {
    flex: 1,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  subtitleDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginRight: theme.spacing.sm,
  },
  subtitleContainer: {
    flex: 1,
  },
  subtitleLine: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 1,
    marginTop: 4,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.md,
    flexGrow: 1,
  },
  overlapContent: {
    paddingHorizontal: theme.spacing.sm,
    flex: 1,
  },
});
