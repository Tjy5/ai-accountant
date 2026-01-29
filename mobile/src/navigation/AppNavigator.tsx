import React from 'react';
import { ActivityIndicator, View, TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../auth/AuthContext';
import { theme } from '../theme';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import TransactionListScreen from '../screens/transactions/TransactionListScreen';
import AddTransactionScreen from '../screens/transactions/AddTransactionScreen';
import EditTransactionScreen from '../screens/transactions/EditTransactionScreen';
import CategoryListScreen from '../screens/categories/CategoryListScreen';
import EditCategoryScreen from '../screens/categories/EditCategoryScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import AISettingsScreen from '../screens/settings/AISettingsScreen';
import BudgetListScreen from '../screens/budgets/BudgetListScreen';
import EditBudgetScreen from '../screens/budgets/EditBudgetScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import AIChatScreen from '../screens/chat/AIChatScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Transactions: undefined;
  Dashboard: undefined;
  Add: undefined;
  Budget: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  AuthStack: undefined;
  MainTabs: undefined;
  TransactionDetail: { id: number };
  TransactionEdit: { id: number };
  CategoryList: undefined;
  CategoryEdit: { id?: number };
  BudgetEdit: { id?: number; budgetType?: 'total' | 'category'; parentId?: number };
  AISettings: undefined;
  AIChat: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: '登录' }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: '注册' }} />
    </AuthStack.Navigator>
  );
}

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Ionicons name="construct-outline" size={48} color="#999" />
    </View>
  );
}

const CustomAddButton = ({ onPress }: any) => (
  <TouchableOpacity
    style={styles.customAddButtonContainer}
    onPress={onPress}
    activeOpacity={0.9}
  >
    <View style={styles.planetWrapper}>
      {/* Decorative Planet Ring */}
      <View style={styles.planetRing} />

      {/* Planet Body */}
      <LinearGradient
        colors={[theme.colors.wealth.primaryLight, theme.colors.wealth.primary, theme.colors.wealth.primaryDark]}
        style={styles.planetBody}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Smooth Rounded Cross */}
        <View style={styles.crossContainer}>
          <View style={styles.crossVertical} />
          <View style={styles.crossHorizontal} />
        </View>
      </LinearGradient>
    </View>
    <Text style={styles.planetLabel}>新增</Text>
  </TouchableOpacity>
);

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.textPrimary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          borderTopWidth: 1,
          elevation: 0,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarIcon: ({ color, size }) => {
          const name =
            route.name === 'Transactions'
              ? 'list'
              : route.name === 'Dashboard'
                ? 'pie-chart'
                : route.name === 'Add'
                  ? 'add-circle'
                  : route.name === 'Budget'
                    ? 'wallet'
                    : 'settings';
          return <Ionicons name={name as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Transactions" component={TransactionListScreen} options={{ title: '明细', headerShown: false }} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: '统计', headerShown: false }} />
      <Tab.Screen
        name="Add"
        component={AddTransactionScreen}
        options={{
          headerShown: false,
          tabBarButton: (props) => <CustomAddButton {...props} />,
        }}
      />
      <Tab.Screen name="Budget" component={BudgetListScreen} options={{ title: '预算' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen name="TransactionEdit" component={EditTransactionScreen} options={{ headerShown: true, title: '编辑交易' }} />
            <RootStack.Screen name="CategoryList" component={CategoryListScreen} options={{ headerShown: true, title: '分类管理' }} />
            <RootStack.Screen name="CategoryEdit" component={EditCategoryScreen} options={{ headerShown: true, title: '编辑分类' }} />
            <RootStack.Screen name="BudgetEdit" component={EditBudgetScreen} options={{ headerShown: true, title: '编辑预算' }} />
            <RootStack.Screen name="AISettings" component={AISettingsScreen} options={{ headerShown: true, title: 'AI 设置' }} />
            <RootStack.Screen name="AIChat" component={AIChatScreen} options={{ headerShown: false, title: 'AI 聊天' }} />
          </>
        ) : (
          <RootStack.Screen name="AuthStack" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  customAddButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    top: -24,
  },
  planetWrapper: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planetBody: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  planetRing: {
    position: 'absolute',
    width: 80,
    height: 24,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    transform: [
      { rotate: '-25deg' },
    ],
    zIndex: 1,
  },
  crossContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossVertical: {
    position: 'absolute',
    width: 4,
    height: 20,
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  crossHorizontal: {
    position: 'absolute',
    width: 20,
    height: 4,
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  planetLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 1,
  },
});
