"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Stack, Text, TextInput, Title, Tabs, Switch, Group, Badge, Table, ActionIcon, Modal } from '@mantine/core';
import { IconInfoCircle, IconEye, IconTrash, IconRefresh } from '@tabler/icons-react';

import { getCurrentUser, updateCurrentUser, getFriends, connectFriendByEmail, confirmPublicFriendRequest, removeFriend } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import ColorPaletteManager, { ColorPalette } from '@/components/ColorPaletteManager';

export default function AccountPage() {
  const router = useRouter();
  const { token, user, setAuth, hydrated } = useAuthStore((s) => ({
    token: s.token,
    user: s.user,
    setAuth: s.setAuth,
    hydrated: s.hydrated
  }));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const [email, setEmail] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [twitchUrl, setTwitchUrl] = useState<string>('');

  // Palettes de couleurs
  const [colorPalettes, setColorPalettes] = useState<ColorPalette[]>([]);
  const [defaultColorPaletteId, setDefaultColorPaletteId] = useState('main');
  const [_palettesSaving, setPalettesSaving] = useState(false);

  // Amis
  const [allowPublicFriendRequests, setAllowPublicFriendRequests] = useState(true);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState<string | undefined>();
  const [friendsSaving, setFriendsSaving] = useState(false);
  type FriendRelation = {
    userId: string;
    pseudo: string;
    email: string;
    status: 'pending' | 'accepted';
    type: 'private-email' | 'public';
  direction?: 'incoming' | 'outgoing';
    presence?: { status: 'disconnected' | 'lobby' | 'running'; roomId?: string; roomName?: string } | null;
  };
  const [friends, setFriends] = useState<FriendRelation[]>([]);
  const [emailToConnect, setEmailToConnect] = useState('');
  const [viewFriend, setViewFriend] = useState<FriendRelation | null>(null);

  useEffect(() => {
    // Attendre l'hydratation avant de décider de rediriger
    if (!hydrated) return;
    if (!token) {
      router.replace('/');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const me = await getCurrentUser(token);
        if (cancelled) return;
        setEmail(me.email);
        setPseudo(me.pseudo);
        setTwitchUrl(me.twitchUrl ?? '');
        setAllowPublicFriendRequests(me.allowPublicFriendRequests ?? true);
        setColorPalettes(me.colorPalettes ?? []);
        setDefaultColorPaletteId(me.defaultColorPaletteId ?? 'main');

        const relations = await getFriends(token);
        if (cancelled) return;
        setFriends(relations);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setFriendsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, token, hydrated]);

  const handleSave = async () => {
    if (!token) return;

    setSaving(true);
    setError(undefined);

    try {
      const updated = await updateCurrentUser(token, {
        pseudo: pseudo.trim(),
        twitchUrl: twitchUrl.trim() ? twitchUrl.trim() : null
      });

      // Mettre à jour le store si le pseudo a changé
      if (user && updated.pseudo !== user.pseudo) {
        setAuth({ token, user: { ...user, pseudo: updated.pseudo } });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack maw={720} mx="auto" p="xl">
        <Title order={2}>Mon compte</Title>
        <Text>Chargement…</Text>
      </Stack>
    );
  }

  const handleTogglePublicRequests = async (value: boolean) => {
    if (!token) return;
    setAllowPublicFriendRequests(value);
    try {
      await updateCurrentUser(token, { allowPublicFriendRequests: value });
    } catch (e) {
      setFriendsError((e as Error).message);
      setAllowPublicFriendRequests((prev) => !prev); // rollback
    }
  };

  const handleConnectByEmail = async () => {
    if (!token || !emailToConnect.trim()) return;
    setFriendsSaving(true);
    setFriendsError(undefined);
    try {
      await connectFriendByEmail(token, emailToConnect.trim());
      const relations = await getFriends(token);
      setFriends(relations);
      setEmailToConnect('');
    } catch (e) {
      setFriendsError((e as Error).message);
    } finally {
      setFriendsSaving(false);
    }
  };

  const handleConfirmPublic = async (requesterUserId: string) => {
    if (!token) return;
    setFriendsSaving(true);
    setFriendsError(undefined);
    try {
      await confirmPublicFriendRequest(token, requesterUserId);
      const relations = await getFriends(token);
      setFriends(relations);
    } catch (e) {
      setFriendsError((e as Error).message);
    } finally {
      setFriendsSaving(false);
    }
  };

  const handleRemoveFriend = async (otherUserId: string) => {
    if (!token) return;
    setFriendsSaving(true);
    setFriendsError(undefined);
    try {
      await removeFriend(token, otherUserId);
      const relations = await getFriends(token);
      setFriends(relations);
    } catch (e) {
      setFriendsError((e as Error).message);
    } finally {
      setFriendsSaving(false);
    }
  };

  const handleRefreshFriends = async () => {
    if (!token) return;
    setFriendsLoading(true);
    setFriendsError(undefined);
    try {
      const relations = await getFriends(token);
      setFriends(relations);
    } catch (e) {
      setFriendsError((e as Error).message);
    } finally {
      setFriendsLoading(false);
    }
  };


  return (
    <Stack maw={720} mx="auto" p="xl" gap="xl">
      <Title order={2}>Mon compte</Title>

      <Tabs defaultValue="profile">
        <Tabs.List>
          <Tabs.Tab value="profile">Profil</Tabs.Tab>
          <Tabs.Tab value="palettes">Palettes</Tabs.Tab>
          <Tabs.Tab value="friends">Amis</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="profile" pt="md">
          <Card withBorder padding="lg" radius="md">
            <Stack>
              <TextInput
                label="Email"
                value={email}
                placeholder="Votre email"
                disabled
              />

              <TextInput
                label="Pseudo public"
                value={pseudo}
                onChange={(e) => setPseudo(e.currentTarget.value)}
                placeholder="Votre pseudo visible par les autres"
              />

              <TextInput
                label="URL du compte Twitch"
                value={twitchUrl}
                onChange={(e) => setTwitchUrl(e.currentTarget.value)}
                placeholder="https://www.twitch.tv/votre_chaine"
              />

              <Button onClick={handleSave} loading={saving} variant="light">
                Enregistrer
              </Button>

              {error && (
                <Alert icon={<IconInfoCircle size={16} />} color="red" title="Oops">
                  {error}
                </Alert>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="palettes" pt="md">
          <ColorPaletteManager
            palettes={colorPalettes}
            defaultPaletteId={defaultColorPaletteId}
            onChange={async (newPalettes, newDefaultId) => {
              try {
                setPalettesSaving(true);
                await updateCurrentUser(token!, {
                  colorPalettes: newPalettes,
                  defaultColorPaletteId: newDefaultId
                });
                setColorPalettes(newPalettes);
                setDefaultColorPaletteId(newDefaultId);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPalettesSaving(false);
              }
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="friends" pt="md">
          <Stack gap="md">
            <Card withBorder padding="lg" radius="md">
              <Stack>
                <Switch
                  checked={allowPublicFriendRequests}
                  label="Recevoir des demandes d'amis publiques"
                  onChange={(e) => handleTogglePublicRequests(e.currentTarget.checked)}
                />

                <Text size="sm" c="dimmed">
                  Si activé, les autres joueurs pourront vous envoyer une demande d'ami en cliquant
                  sur votre pseudo dans une partie ou un lobby.
                </Text>
              </Stack>
            </Card>

            <Card withBorder padding="lg" radius="md">
              <Stack>
                <TextInput
                  label="Se connecter à un ami via son email"
                  placeholder="adresse@email.com"
                  value={emailToConnect}
                  onChange={(e) => setEmailToConnect(e.currentTarget.value)}
                />
                <Button onClick={handleConnectByEmail} loading={friendsSaving} variant="light">
                  Envoyer demande de connexion
                </Button>
                <Text size="sm" c="dimmed">
                  Les demandes privées ne génèrent pas de notification. Les deux personnes doivent
                  entrer l'email l'une de l'autre pour confirmer la connexion.
                </Text>
              </Stack>
            </Card>

            <Card withBorder padding="lg" radius="md">
              <Stack>
                <Group justify="space-between" align="center">
                  <Title order={4}>Mes amis</Title>
                  <Group gap="xs">
                    {friendsLoading && <Text size="sm">Chargement…</Text>}
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconRefresh size={14} />}
                      onClick={handleRefreshFriends}
                      disabled={friendsLoading || friendsSaving}
                    >
                      Rafraîchir
                    </Button>
                  </Group>
                </Group>

                {friendsError && (
                  <Alert icon={<IconInfoCircle size={16} />} color="red" title="Oops">
                    {friendsError}
                  </Alert>
                )}

                {friends.length === 0 && !friendsLoading && (
                  <Text size="sm" c="dimmed">
                    Vous n'avez pas encore d'amis. Connectez-vous via email ou depuis une partie.
                  </Text>
                )}

                {friends.length > 0 && (
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                          <Table.Th>Pseudo</Table.Th>
                          <Table.Th>Email</Table.Th>
                          <Table.Th>Salle</Table.Th>
                          <Table.Th>Statut</Table.Th>
                          <Table.Th style={{ width: 90 }}>Actions</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {friends.map((f) => (
                        <Table.Tr key={f.userId}>
                          <Table.Td>{f.pseudo}</Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">{f.email}</Text>
                          </Table.Td>

                          <Table.Td>
                            {f.presence?.status === 'disconnected' && (
                              <Text size="sm" c="dimmed">Déconnecté</Text>
                            )}
                            {f.presence?.status === 'lobby' && (
                              <Button size="xs" variant="light" onClick={() => router.push(`/game/${f.presence?.roomId}`)}>
                                Rejoindre le lobby
                              </Button>
                            )}
                            {f.presence?.status === 'running' && (
                              <Button size="xs" variant="light" onClick={() => router.push(`/game/${f.presence?.roomId}`)}>
                                Partie en cours — Rejoindre
                              </Button>
                            )}
                          </Table.Td>

                          <Table.Td>
                            <Badge color={f.status === 'accepted' ? 'green' : 'yellow'} variant="light">
                              {f.status === 'accepted' ? 'Accepté' : 'En attente'}
                            </Badge>
                            {f.type === 'public' && f.status === 'pending' && f.direction === 'incoming' && allowPublicFriendRequests && (
                              <Button
                                size="xs"
                                variant="light"
                                loading={friendsSaving}
                                ml="xs"
                                onClick={() => handleConfirmPublic(f.userId)}
                              >
                                Confirmer
                              </Button>
                            )}
                          </Table.Td>

                          <Table.Td>
                            <Group gap={4}>
                              <ActionIcon
                                variant="light"
                                aria-label="Voir le compte"
                                onClick={() => setViewFriend(f)}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="light"
                                color="red"
                                aria-label="Supprimer l'ami"
                                loading={friendsSaving}
                                onClick={() => handleRemoveFriend(f.userId)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Stack>
            </Card>
            <Modal opened={!!viewFriend} onClose={() => setViewFriend(null)} title="Détails de l'ami" centered>
              {viewFriend && (
                <Stack gap="xs">
                  <Text><strong>Pseudo:</strong> {viewFriend.pseudo}</Text>
                  <Text><strong>Email:</strong> {viewFriend.email}</Text>
                  <Text><strong>Statut:</strong> {viewFriend.status === 'accepted' ? 'Accepté' : 'En attente'}</Text>
                  <Text><strong>Type:</strong> {viewFriend.type === 'public' ? 'Public' : 'Privé (email)'}</Text>
                </Stack>
              )}
            </Modal>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
