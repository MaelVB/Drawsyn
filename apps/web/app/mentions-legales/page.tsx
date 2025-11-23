'use client';

import { Container, Title, Text, Stack, Paper } from '@mantine/core';

export default function MentionsLegalesPage() {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Title order={1}>Mentions Légales</Title>
        
        <Paper p="xl" withBorder>
          <Stack gap="lg">
            <div>
              <Title order={2} size="h3" mb="sm">Éditeur du site</Title>
              <Text>
                Nom : Drawsyn<br />
                Responsable de la publication : MaelVB
              </Text>
            </div>

            <div>
              <Title order={2} size="h3" mb="sm">Hébergement</Title>
              <Text>
                Le site est hébergé par un prestataire d'hébergement web.
              </Text>
            </div>

            <div>
              <Title order={2} size="h3" mb="sm">Propriété intellectuelle</Title>
              <Text>
                L'ensemble du contenu de ce site (textes, images, vidéos, etc.) est protégé par le droit d'auteur. 
                Toute reproduction, distribution ou utilisation sans autorisation préalable est interdite.
              </Text>
            </div>

            <div>
              <Title order={2} size="h3" mb="sm">Données personnelles</Title>
              <Text>
                Les données collectées sur ce site sont utilisées uniquement dans le cadre du fonctionnement 
                de l'application. Conformément au RGPD, vous disposez d'un droit d'accès, de rectification 
                et de suppression de vos données personnelles.
              </Text>
            </div>

            <div>
              <Title order={2} size="h3" mb="sm">Cookies</Title>
              <Text>
                Ce site utilise des cookies techniques nécessaires au bon fonctionnement de l'application.
              </Text>
            </div>

            <div>
              <Title order={2} size="h3" mb="sm">Contact</Title>
              <Text>
                Pour toute question concernant ces mentions légales, vous pouvez nous contacter via notre{' '}
                <a href="https://linktr.ee/maelvb" target="_blank" rel="noopener noreferrer" 
                   style={{ color: '#228be6' }}>
                  Linktree
                </a>.
              </Text>
            </div>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
