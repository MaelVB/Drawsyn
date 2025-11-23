'use client';

import { Container, Title, Accordion, Stack } from '@mantine/core';

export default function FAQPage() {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Title order={1}>FAQ - Foire Aux Questions</Title>
        
        <Accordion variant="separated">
          <Accordion.Item value="qu-est-ce">
            <Accordion.Control>Qu'est-ce que Drawsyn ?</Accordion.Control>
            <Accordion.Panel>
              Drawsyn est un jeu de dessin en temps réel inspiré de Skribbl.io. 
              Dessinez et devinez les mots de vos amis dans des parties multijoueurs amusantes !
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="comment-jouer">
            <Accordion.Control>Comment jouer ?</Accordion.Control>
            <Accordion.Panel>
              1. Créez un compte ou connectez-vous<br />
              2. Créez une salle ou rejoignez-en une existante<br />
              3. Attendez que d'autres joueurs rejoignent<br />
              4. À votre tour, dessinez le mot qui vous est donné<br />
              5. Devinez ce que les autres joueurs dessinent pour gagner des points !
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="combien-joueurs">
            <Accordion.Control>Combien de joueurs peuvent participer ?</Accordion.Control>
            <Accordion.Panel>
              Une partie peut accueillir entre 2 et 8 joueurs simultanément.
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="items">
            <Accordion.Control>Que sont les items ?</Accordion.Control>
            <Accordion.Panel>
              Les items sont des objets cosmétiques (palettes de couleurs, effets visuels) 
              que vous pouvez débloquer et utiliser pour personnaliser votre expérience de jeu.
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="amis">
            <Accordion.Control>Comment ajouter des amis ?</Accordion.Control>
            <Accordion.Panel>
              Rendez-vous dans votre profil pour gérer votre liste d'amis. 
              Vous pouvez envoyer des demandes d'amis et les accepter.
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="probleme-technique">
            <Accordion.Control>J'ai un problème technique, que faire ?</Accordion.Control>
            <Accordion.Panel>
              Essayez d'abord de rafraîchir la page. Si le problème persiste, 
              n'hésitez pas à nous contacter via notre{' '}
              <a href="https://linktr.ee/maelvb" target="_blank" rel="noopener noreferrer" 
                 style={{ color: '#228be6' }}>
                Linktree
              </a>.
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="navigateurs">
            <Accordion.Control>Quels navigateurs sont supportés ?</Accordion.Control>
            <Accordion.Panel>
              Drawsyn fonctionne sur tous les navigateurs modernes (Chrome, Firefox, Safari, Edge). 
              Nous recommandons d'utiliser la dernière version de votre navigateur pour une expérience optimale.
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="gratuit">
            <Accordion.Control>Le jeu est-il gratuit ?</Accordion.Control>
            <Accordion.Panel>
              Oui ! Drawsyn est entièrement gratuit et accessible à tous.
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    </Container>
  );
}
