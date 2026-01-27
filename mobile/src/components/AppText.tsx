import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { theme } from '../theme';

interface AppTextProps extends TextProps {
    variant?: 'header' | 'title' | 'body' | 'caption';
    bold?: boolean;
    color?: string;
    centered?: boolean;
}

export const AppText: React.FC<AppTextProps> = ({
    children,
    variant = 'body',
    bold,
    color,
    centered,
    style,
    ...props
}) => {
    const variantStyle = theme.typography[variant];

    const finalStyle: TextStyle = {
        ...variantStyle,
        color: color || (variant === 'caption' ? theme.colors.textSecondary : theme.colors.textPrimary),
        fontWeight: bold ? '700' : variantStyle.fontWeight,
        textAlign: centered ? 'center' : 'auto',
    };

    return (
        <Text style={[finalStyle, style]} {...props}>
            {children}
        </Text>
    );
};
