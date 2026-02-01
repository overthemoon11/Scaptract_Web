import styles from '@/styles/ExtractionProgressBar.module.css';

interface ExtractionProgressBarProps {
  currentStep: number;
  steps: string[];
}

export default function ExtractionProgressBar({ currentStep, steps }: ExtractionProgressBarProps) {
  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressBar}>
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isPending = stepNumber > currentStep;

          return (
            <div key={index} className={styles.stepWrapper}>
              <div className={styles.stepContent}>
                <div
                  className={`${styles.stepCircle} ${
                    isCompleted
                      ? styles.completed
                      : isActive
                      ? styles.active
                      : styles.pending
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ position: 'relative', zIndex: 1 }}
                    >
                      <path
                        d="M13.3333 4L6 11.3333L2.66667 8"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : isActive ? (
                    <>
                      <div className={styles.loadingAnimation}></div>
                      <span className={styles.stepNumber} style={{ color: 'white' }}>{stepNumber}</span>
                    </>
                  ) : (
                    <span className={styles.stepNumber}>{stepNumber}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`${styles.connector} ${
                      isCompleted ? styles.connectorCompleted : styles.connectorPending
                    }`}
                  />
                )}
              </div>
              <div className={styles.stepLabel}>
                <span className={styles.stepLabelText}>{step}</span>
                <span className={styles.stepLabelText}> </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
