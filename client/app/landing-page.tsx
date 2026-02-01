import { useState } from 'react';
import styles from '@/styles/LandingPage.module.css';
import Layout from '@/components/Layout';
import { Link } from 'react-router-dom';

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const benefits = [
    {
      icon: '🔒',
      title: 'Localhost Deployment',
      text: 'Your data never leaves your machine, ensuring maximum privacy and security.'
    },
    {
      icon: '🛡️',
      title: 'Very Secure',
      text: 'Enterprise-grade security with encrypted data processing at every step.'
    },
    {
      icon: '⚡',
      title: 'Lightning Fast',
      text: 'Process documents in seconds with our optimized AI engine.'
    },
    {
      icon: '🎯',
      title: 'High Accuracy',
      text: '99%+ accuracy in text extraction from complex layouts and poor-quality images.'
    },
    {
      icon: '📊',
      title: 'Easy Integration',
      text: 'Simple API and export options for seamless workflow integration.'
    },
    {
      icon: '💰',
      title: 'Cost Effective',
      text: 'No cloud fees, no subscription limits. Process unlimited documents.'
    }
  ];

  const handleDotClick = (index: number) => {
    setCurrentSlide(index);
  };
  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.firstSection}>
            <h1 className={styles.mainTitle}>Scan. Capture. Extract.</h1>
            <p className={styles.mainDescription}>Turns reports, images, and documents into structured data you can trust.</p>
            <div className={styles.startButtonContainer}>
              <Link to="/auth/login">
                <button className={styles.startButton}>Get Started</button>
              </Link>
            </div>
            <div className={styles.imageContainer}>
              <img src="/images/landing-design.png" alt="Scaptract" />
            </div>
          </div>
          <div className={styles.secondSection}>
            <h1 className={styles.secondSectionTitle}>Powered by Advanced Technology</h1>
            <div className={styles.secondSectionContent}>
              <div className={`${styles.secondSectionContainer} ${styles.ocrContainer}`}>
              <div className={styles.imageContainer}>
                <span className={styles.imageContainerText}>OCR</span>
                {/* <img src="/images/ocr.png" alt="OCR" /> */}
              </div>
              <div className={styles.ocrDescription}>
                <p>A technology that converts scanned documents, images, or handwritten text into machine-readable and editable digital text. Modern OCR uses AI and deep learning to achieve high accuracy, even for complex layouts or poor-quality images.</p>
              </div>
            </div>
            
            <div className={styles.carouselWrapper}>
              <div className={styles.carouselInner} style={{ '--quantity': '10' } as React.CSSProperties}>
                <div className={styles.carouselCard} style={{ '--index': '0', '--color-card': '142, 249, 252' } as React.CSSProperties}>
                  <div className={styles.carouselImg}></div>
                </div>
                <div className={styles.carouselCard} style={{ '--index': '1', '--color-card': '142, 252, 204' } as React.CSSProperties}>
                  <div className={styles.carouselImg}></div>
                </div>
                <div className={styles.carouselCard} style={{ '--index': '2', '--color-card': '142, 252, 157' } as React.CSSProperties}>
                  <div className={styles.carouselImg}></div>
                </div>
                <div className={styles.carouselCard} style={{ '--index': '3', '--color-card': '215, 252, 142' } as React.CSSProperties}>
                  <div className={styles.carouselImg}></div>
                </div>
                <div className={styles.carouselCard} style={{ '--index': '4', '--color-card': '252, 252, 142' } as React.CSSProperties}>
                  <div className={styles.carouselImg}></div>
                </div>
                <div className={styles.carouselCard} style={{ '--index': '5', '--color-card': '252, 208, 142' } as React.CSSProperties}>
                  <div className={styles.carouselImg}></div>
                </div>
                <div className={styles.carouselCard} style={{ '--index': '6', '--color-card': '252, 142, 142' } as React.CSSProperties}>
                  <div className={styles.carouselImg}></div>
                </div>
                <div className={styles.carouselCard} style={{ '--index': '7', '--color-card': '252, 142, 239' } as React.CSSProperties}>
                  <div className={styles.carouselImg}></div>
                </div>
                <div className={styles.carouselCard} style={{ '--index': '8', '--color-card': '204, 142, 252' } as React.CSSProperties}>
                  <div className={styles.carouselImg}></div>
                </div>
                <div className={styles.carouselCard} style={{ '--index': '9', '--color-card': '142, 202, 252' } as React.CSSProperties}>
                  <div className={styles.carouselImg}></div>
                </div>
              </div>
            </div>
            
            <div className={`${styles.secondSectionContainer} ${styles.nlpContainer}`}>
              <div className={styles.imageContainer}>
                <span className={styles.imageContainerText}>NLP</span>
                {/* <img src="/images/nlp.png" alt="NLP" /> */}
              </div>
              <div className={styles.nlpDescription}>
                <p>A branch of AI that enables computers to understand, interpret, and generate human language. NLP techniques (like tokenization, named entity recognition, and transformer models) extract meaning, sentiment, and relationships from text data.</p>
              </div>
            </div>
            </div>
          </div>
          <div className={styles.thirdSection}>
            <div className={styles.thirdSectionContent}>
            <h1 className={styles.thirdSectionTitle}>How It Works</h1>
            <p className={styles.thirdSectionSubtitle}>
              Transform your documents into structured data with our AI-powered extraction platform.
            </p>
            <div className={styles.stepsContainer}>
              <div className={styles.stepCard}>
                <div className={styles.stepIconWrapper}>
                  <div className={styles.dragDropIcon}>
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" fill="none"/>
                      <path d="M8 12L12 8M12 8L16 12M12 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
                <h2 className={styles.stepTitle}>Step 1: Upload</h2>
                <p className={styles.stepDescription}>
                  Drag-and-drop files or snap images. Supports PDF, JPG, PNG, and more formats.
                </p>
              </div>
              
              <div className={styles.stepCard}>
                <div className={styles.stepIconWrapper}>
                  <div className={styles.searchIcon}>
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
                      <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
                <h2 className={styles.stepTitle}>Step 2: Extract</h2>
                <p className={styles.stepDescription}>
                  AI automatically detects and extracts text, tables, and structured data with precision.
                </p>
              </div>
              
              <div className={styles.stepCard}>
                <div className={styles.stepIconWrapper}>
                  <div className={styles.analyzeIcon}>
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M7 16l4-4 4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      <circle cx="7" cy="16" r="2" fill="currentColor"/>
                      <circle cx="11" cy="12" r="2" fill="currentColor"/>
                      <circle cx="15" cy="12" r="2" fill="currentColor"/>
                      <circle cx="21" cy="6" r="2" fill="currentColor"/>
                    </svg>
                  </div>
                </div>
                <h2 className={styles.stepTitle}>Step 3: Analyze</h2>
                <p className={styles.stepDescription}>
                  Export data in multiple formats and analyze trends to make data-driven decisions.
                </p>
              </div>
              
              <div className={styles.stepsConnector}>
                <svg className={styles.connectorSvg} viewBox="0 0 1000 300" preserveAspectRatio="none">
                  <path 
                    d="M 50 150 Q 250 -20, 500 150 T 950 150" 
                    fill="none" 
                    stroke="rgba(255, 255, 255, 0.5)" 
                    strokeWidth="2" 
                    strokeDasharray="8, 8"
                  />
                  <polygon 
                    points="945,145 950,150 945,155" 
                    fill="rgba(255, 255, 255, 0.5)" 
                  />
                </svg>
              </div>
            </div>
            </div>
          </div>
          <div className={styles.benefitsSection}>
            <h1 className={styles.benefitsTitle}>Get The Highlights</h1>
            <div className={styles.benefitsCarouselWrapper}>
              <div 
                className={styles.benefitsCarouselTrack}
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {benefits.map((benefit, index) => (
                  <div key={index} className={styles.benefitShowcaseCard}>
                    <div className={styles.benefitShowcaseIcon}>{benefit.icon}</div>
                    <h3 className={styles.benefitShowcaseTitle}>{benefit.title}</h3>
                    <p className={styles.benefitShowcaseText}>{benefit.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.benefitsCarouselDots}>
              {benefits.map((_, index) => (
                <span
                  key={index}
                  className={currentSlide === index ? styles.carouselDotActive : styles.carouselDot}
                  onClick={() => handleDotClick(index)}
                ></span>
              ))}
            </div>
          </div>
          <div className={styles.ctaSection}>
            <div className={styles.ctaContainer}>
              <h1 className={styles.ctaTitle}>Ready to Transform Your Documents?</h1>
              <p className={styles.ctaDescription}>
                Join thousands of users who trust Scaptract for secure, accurate document extraction.
                Get started in seconds with our localhost deployment.
              </p>
              <div className={styles.ctaButtons}>
                <Link to="/auth/register">
                  <button className={styles.ctaPrimaryButton}>Start Now</button>
                </Link>
                <Link to="/auth/login">
                  <button className={styles.ctaSecondaryButton}>Sign In</button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

