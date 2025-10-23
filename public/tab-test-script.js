/**
 * 탭 이동 테스트 자동화 스크립트
 * 브라우저 콘솔에서 실행하여 탭 이동을 자동으로 테스트합니다.
 */

function autoTabSwitchTest(iterations = 15) {
    console.log(`🚀 탭 이동 테스트 시작: ${iterations}회 반복`);
    
    let currentIteration = 0;
    let errorCount = 0;
    let successCount = 0;
    
    function getTabButtons() {
        return document.querySelectorAll('nav button');
    }
    
    function getCurrentActiveTab() {
        const buttons = getTabButtons();
        for (let btn of buttons) {
            if (btn.classList.contains('bg-black')) {
                return btn.textContent.trim();
            }
        }
        return null;
    }
    
    function clickTab(tabName) {
        const buttons = getTabButtons();
        for (let btn of buttons) {
            if (btn.textContent.trim() === tabName) {
                console.log(`🖱️ ${tabName} 탭 클릭 (${currentIteration + 1}/${iterations})`);
                btn.click();
                return true;
            }
        }
        return false;
    }
    
    function checkForErrors() {
        // ErrorBoundary 화면 체크
        if (document.querySelector('h1') && document.querySelector('h1').textContent.includes('오류가 발생했습니다')) {
            console.error('❌ ErrorBoundary 화면 감지됨!');
            return true;
        }
        
        // 콘솔 오류 체크는 자동으로 캐치됨
        return false;
    }
    
    function performTest() {
        try {
            if (currentIteration >= iterations) {
                console.log(`✅ 테스트 완료! 성공: ${successCount}, 오류: ${errorCount}`);
                if (errorCount === 0) {
                    console.log('🎉 모든 탭 이동이 성공적으로 완료되었습니다!');
                } else {
                    console.warn(`⚠️ ${errorCount}개의 오류가 발생했습니다.`);
                }
                return;
            }
            
            // 현재 탭 확인
            const currentTab = getCurrentActiveTab();
            console.log(`📍 현재 활성 탭: ${currentTab}`);
            
            // 다른 탭으로 전환
            const targetTab = currentTab === '영상' ? '유튜브' : '영상';
            
            if (clickTab(targetTab)) {
                // 잠깐 대기 후 오류 체크
                setTimeout(() => {
                    if (checkForErrors()) {
                        errorCount++;
                        console.error(`❌ ${currentIteration + 1}번째 테스트에서 오류 발생`);
                    } else {
                        successCount++;
                        console.log(`✅ ${currentIteration + 1}번째 테스트 성공`);
                    }
                    
                    currentIteration++;
                    
                    // 다음 테스트를 위해 잠깐 대기
                    setTimeout(performTest, 500);
                }, 1000);
            } else {
                console.error(`❌ ${targetTab} 탭을 찾을 수 없습니다`);
                errorCount++;
                currentIteration++;
                setTimeout(performTest, 500);
            }
            
        } catch (error) {
            console.error(`❌ 테스트 실행 중 오류: ${error.message}`);
            errorCount++;
            currentIteration++;
            setTimeout(performTest, 500);
        }
    }
    
    // 테스트 시작
    performTest();
}

// 사용법:
// autoTabSwitchTest(15); // 15회 탭 이동 테스트
console.log('📝 탭 이동 테스트 스크립트가 로드되었습니다.');
console.log('💡 사용법: autoTabSwitchTest(15); // 괄호 안에 테스트 횟수 입력');