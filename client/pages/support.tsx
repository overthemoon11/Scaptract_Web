import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Link } from 'react-router-dom';
import styles from '@/styles/Support.module.css';
import { User } from '@shared/types';

interface FAQItem {
  _id?: string | number;
  id?: string | number;
  title: string;
  description: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function SupportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        // Fetch FAQs from database (public endpoint)
        const faqRes = await fetch('/api/support/faq', { credentials: 'include' });
        if (faqRes.ok) {
          const faqData = await faqRes.json();
          if (Array.isArray(faqData)) {
            setFaqs(faqData.map((faq: any) => ({
              _id: faq.id || faq._id,
              id: faq.id || faq._id,
              title: faq.title || faq.question || '',
              description: faq.description || faq.answer || '',
              status: faq.status || 'active',
              createdAt: faq.created_at || faq.createdAt,
              updatedAt: faq.updated_at || faq.updatedAt
            })));
          }
        } else {
          console.error('Failed to fetch FAQs:', faqRes.status, faqRes.statusText);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <Layout user={user} loading={loading} loadingText="Loading">
      <div className={styles.container} data-tg-tour="❓ Frequently Asked Questions - Browse through common questions and answers. Click on any question to expand and view the answer.">
        <h1 className={styles.faqTitle}>Frequently Asked Questions</h1>
        <hr className={styles.faqDivider} />
        <div className={styles.faqBox}>
          {faqs.map((faq, idx) => (
            <div key={faq._id || faq.id || idx} className={styles.faqItem} data-tg-tour={idx === 0 ? "💡 Interactive FAQ - Click the + button to expand any FAQ item. This will show you detailed answers to help solve your questions." : ""}>
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className={styles.faqButton}
              >
                <span className={styles.faqIcon}>{openIndex === idx ? '-' : '+'}</span>
                <span>{faq.title}</span>
              </button>
              {openIndex === idx && (
                <div className={styles.faqAnswer}>
                  {faq.description}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className={styles.faqBottom}>
          Does not find your problem? Click <Link to="/support/ticket" className={styles.faqLink} data-tg-tour="🎫 Submit Support Ticket - If you can't find your answer in the FAQ, click here to submit a detailed support ticket to our team.">here</Link> to submit your ticket.
        </div>
      </div>
    </Layout>
  );
}

