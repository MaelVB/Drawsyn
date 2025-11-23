'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Container, Group, Text } from '@mantine/core';

export default function Footer() {
  const pathname = usePathname();
  
  // Vérifier si on est dans un lobby ou une game
  const isInGame = pathname?.startsWith('/game/');
  const showFullFooter = !isInGame;

  return (
    <footer style={{ 
      borderTop: '1px solid #373A40',
      padding: '2rem 0',
      marginTop: 'auto'
    }}>
      <Container>
        {showFullFooter && (
          <Group justify="center" gap="xl">
            <Link 
              href="/mentions-legales"
              passHref
              legacyBehavior
            >
              <a
                style={{ 
                  color: '#909296', 
                  textDecoration: 'none',
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#C1C2C5'}
                onMouseOut={(e) => e.currentTarget.style.color = '#909296'}
              >
                Mentions Légales
              </a>
            </Link>
            
            <Link 
              href="/faq"
              passHref
              legacyBehavior
            >
              <a
                style={{ 
                  color: '#909296', 
                  textDecoration: 'none',
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#C1C2C5'}
                onMouseOut={(e) => e.currentTarget.style.color = '#909296'}
              >
                FAQ
              </a>
            </Link>
            
            <a 
              href="https://linktr.ee/maelvb" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#909296', 
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#C1C2C5'}
              onMouseOut={(e) => e.currentTarget.style.color = '#909296'}
            >
              Linktree
            </a>
          </Group>
        )}
        
        <Text 
          size="xs" 
          c="dimmed" 
          ta="center" 
          mt={showFullFooter ? "md" : undefined}
        >
          © {new Date().getFullYear()} Drawsyn. Tous droits réservés.
        </Text>
      </Container>
    </footer>
  );
}
