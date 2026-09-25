export const colors = {
    gradient: ['#4A2FB0', '#7B2FF7', '#C13FD6', '#E95AC2', '#F7B8DE'] as const,

    primary: '#7B2FF7',
    primaryDark: '#4A2FB0',
    secondary: '#E95AC2',

    danger: '#FF3B5C',
    dangerDark: '#D6203F',

    textDark: '#2B1A42',
    textMuted: '#7A6B94',
    white: '#FFFFFF',

    cardBackground: 'rgba(255,255,255,0.92)',
    cardBorder: 'rgba(255,255,255,0.6)',

    inputBackground: 'rgba(245, 240, 251, 0.9)',
    border: '#E4D9F7',
    success: '#3FD68C',
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const radius = {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    pill: 999,
};

export const shadow = {
    card: {
        shadowColor: '#4A2FB0',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    button: {
        shadowColor: '#7B2FF7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 5,
    },
};

export const typography = {
    heading: {
        fontSize: 28,
        fontFamily: 'Poppins_800ExtraBold',
        color: colors.textDark,
    },
    subheading: {
        fontSize: 16,
        fontFamily: 'Poppins_500Medium',
        color: colors.textMuted,
    },
    body: {
        fontSize: 15,
        fontFamily: 'Poppins_400Regular',
        color: colors.textDark,
    },
    button: {
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
        color: colors.white,
    },
};
