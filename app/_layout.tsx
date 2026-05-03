import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { TransportProvider } from "@/lib/transport";

export default function RootLayout() {
  return (
    <AuthProvider>
      <TransportProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </TransportProvider>
    </AuthProvider>
  );
}
