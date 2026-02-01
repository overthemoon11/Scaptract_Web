import styles from '@/styles/Loading.module.css';

interface LoadingProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function Loading({ text = 'Loading', size = 'medium' }: LoadingProps) {
  const sizeClass = styles[size];
  
  return (
    <div className={`${styles.loaderWrapper} ${sizeClass}`}>
      {text.split('').map((letter, index) => (
        <span key={index} className={styles.loaderLetter}>
          {letter === ' ' ? '\u00A0' : letter}
        </span>
      ))}
      <div className={styles.loader}></div>
    </div>
  );
}

