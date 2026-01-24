import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../auth/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import TransactionListScreen from '../screens/transactions/TransactionListScreen';
import AddTransactionScreen from '../screens/transactions/AddTransactionScreen';
import EditTransactionScreen from '../screens/transactions/EditTransactionScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

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

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
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
      <Tab.Screen name="Transactions" component={TransactionListScreen} options={{ title: '明细' }} />
      <Tab.Screen name="Dashboard" component={() => <PlaceholderScreen title="统计" />} />
      <Tab.Screen name="Add" component={AddTransactionScreen} options={{ title: '新增' }} />
      <Tab.Screen name="Budget" component={() => <PlaceholderScreen title="预算" />} />
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
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen name="TransactionEdit" component={EditTransactionScreen} options={{ headerShown: true, title: '编辑交易' }} />
          </>
        ) : (
          <RootStack.Screen name="AuthStack" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
